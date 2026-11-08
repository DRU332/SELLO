"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, UUID_RE } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

const slugRe = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(["admin", "api", "panel", "entrar", "legal", "staff", "sellar", "demo"]);

const newBusiness = z.object({
  name: z.string().trim().min(2, "Nombre muy corto").max(80),
  slug: z.string().trim().toLowerCase().regex(slugRe, "La dirección solo puede tener minúsculas, números y guiones (3 a 40)."),
  owner_email: z.string().trim().toLowerCase().email("Correo inválido"),
  status: z.enum(["trial", "active", "suspended"]),
  trial_ends_at: z.string().optional().transform((v) => (v ? v : null)),
});

const genPassword = () => randomBytes(15).toString("base64url");

async function audit(businessId: string | null, actor: string, action: string, details: Record<string, unknown> = {}) {
  await adminClient().from("audit_log").insert({ business_id: businessId, actor_type: "admin", actor_id: actor, action, details });
}

export type CreateResult = { ok: boolean; error?: string; businessId?: string; email?: string; password?: string | null; slug?: string };

export async function createBusinessAction(_prev: CreateResult | null, formData: FormData): Promise<CreateResult> {
  const { user } = await requireAdmin();
  const parsed = newBusiness.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (RESERVED.has(d.slug)) return { ok: false, error: "Esa dirección está reservada. Elige otra." };
  const sb = adminClient();

  const { data: exists } = await sb.from("businesses").select("id").eq("slug", d.slug).maybeSingle();
  if (exists) return { ok: false, error: "Ya existe un negocio con esa dirección." };

  // Dueño: si ya existe un usuario con ese correo se reutiliza (p. ej. dueño con 2 negocios)
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  let ownerId = list?.users.find((u) => u.email === d.owner_email)?.id ?? null;
  let password: string | null = null;
  if (!ownerId) {
    password = genPassword();
    const { data, error } = await sb.auth.admin.createUser({ email: d.owner_email, password, email_confirm: true });
    if (error || !data.user) return { ok: false, error: "No se pudo crear el usuario del dueño." };
    ownerId = data.user.id;
  }

  const { data: b, error } = await sb.from("businesses")
    .insert({ name: d.name, slug: d.slug, status: d.status, trial_ends_at: d.trial_ends_at }).select("id").single();
  if (error || !b) return { ok: false, error: "No se pudo crear el negocio." };
  await sb.from("business_owners").insert({ business_id: b.id, user_id: ownerId });
  await audit(b.id, user.id, "business.created", { slug: d.slug, owner: d.owner_email });
  revalidatePath("/admin");
  return { ok: true, businessId: b.id, email: d.owner_email, password, slug: d.slug };
}

export async function updateBusinessAction(businessId: string, _prev: unknown, formData: FormData) {
  const { sb: userSb, user } = await requireAdmin();
  if (!UUID_RE.test(businessId)) return { ok: false, message: "Negocio inválido." };
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const status = String(formData.get("status") ?? "");
  const trial = String(formData.get("trial_ends_at") ?? "") || null;
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Nombre inválido." };
  if (!slugRe.test(slug) || RESERVED.has(slug)) return { ok: false, message: "Dirección inválida." };
  if (!["trial", "active", "suspended"].includes(status)) return { ok: false, message: "Estado inválido." };

  const sb = adminClient();
  const { data: clash } = await sb.from("businesses").select("id").eq("slug", slug).neq("id", businessId).maybeSingle();
  if (clash) return { ok: false, message: "Esa dirección ya la usa otro negocio." };
  const { error } = await sb.from("businesses").update({ name, slug, trial_ends_at: trial }).eq("id", businessId);
  if (error) return { ok: false, message: "No se pudo guardar." };
  // El cambio de estado pasa por la función que verifica que seas superadmin y lo registra
  const { data: st } = await userSb.rpc("admin_set_business_status", { p_business_id: businessId, p_status: status });
  if (!st?.ok) return { ok: false, message: "No se pudo cambiar el estado." };
  await audit(businessId, user.id, "business.updated", { name, slug, trial });
  revalidatePath("/admin");
  revalidatePath(`/admin/negocios/${businessId}`);
  return { ok: true, message: "Cambios guardados." };
}

export async function resetOwnerPasswordAction(businessId: string, ownerId: string) {
  const { user } = await requireAdmin();
  if (!UUID_RE.test(businessId) || !UUID_RE.test(ownerId)) return { ok: false as const };
  const sb = adminClient();
  const { data: link } = await sb.from("business_owners").select("user_id").eq("business_id", businessId).eq("user_id", ownerId).maybeSingle();
  if (!link) return { ok: false as const };
  const password = genPassword();
  const { error } = await sb.auth.admin.updateUserById(ownerId, { password });
  if (error) return { ok: false as const };
  await audit(businessId, user.id, "owner.password_reset", { owner: ownerId });
  return { ok: true as const, password };
}

export async function publishLegalAction(_prev: unknown, formData: FormData) {
  const { sb, user } = await requireAdmin();
  const kind = String(formData.get("kind"));
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const isDraft = formData.get("is_draft") === "on";
  if (!["privacy", "terms"].includes(kind) || title.length < 3 || body.length < 20 || body.length > 30000) {
    return { ok: false, message: "Revisa el título y el texto." };
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const { count } = await adminClient().from("legal_documents").select("id", { count: "exact", head: true })
    .eq("kind", kind).like("version", `${today}.%`);
  const version = `${today}.${(count ?? 0) + 1}`;
  // Inserción con la sesión del superadmin (la RLS lo exige)
  const { error } = await sb.from("legal_documents").insert({ kind, version, title, body, is_draft: isDraft, created_by: user.id });
  if (error) return { ok: false, message: "No se pudo publicar." };
  revalidatePath("/admin/legal");
  return { ok: true, message: `Publicada la versión ${version}. Los nuevos registros guardarán esta versión.` };
}
