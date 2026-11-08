"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth";
import { logoUrl } from "@/lib/brand";
import { processLogo } from "@/lib/logo";
import { adminClient } from "@/lib/supabase/admin";

const hex = z.string().regex(/^#[0-9a-f]{6}$/, "Color inválido");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, "Hora inválida");
const optDate = z.string().optional().transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida");

const schema = z.object({
  name: z.string().trim().min(2, "El nombre del negocio es muy corto.").max(80),
  primary_color: hex,
  secondary_color: hex,
  stamp_icon: z.enum(["cafe", "estrella", "corazon", "cubiertos", "pan", "taco", "hoja", "regalo"]),
  avg_ticket_mxn: z.coerce.number().min(0, "El ticket no puede ser negativo.").max(99999),
  at_risk_days: z.coerce.number().int().min(7).max(365),
  frequent_min_visits: z.coerce.number().int().min(2).max(50),
  stamps_required: z.coerce.number().int().min(3, "Mínimo 3 sellos.").max(20, "Máximo 20 sellos."),
  signup_gift: z.coerce.number().int().min(0).max(19),
  reward_final: z.string().trim().min(2, "Describe el premio.").max(120),
  reward_mid: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  reward_mid_at: z.string().optional().transform((v) => (v ? Number(v) : null)),
  valid_from: optDate,
  valid_until: optDate,
  restrictions: z.string().trim().max(500).default(""),
  cooldown_minutes: z.coerce.number().int().min(0).max(1440),
  double_rules: z.string().transform((v, ctx) => {
    try { return JSON.parse(v); } catch { ctx.addIssue({ code: "custom", message: "Reglas inválidas" }); return []; }
  }).pipe(z.array(z.object({
    days: z.array(z.number().int().min(0).max(6)).min(1, "Elige al menos un día para el doble sello."),
    from: time, to: time,
  }).refine((r) => r.from < r.to, "En el doble sello, la hora de inicio debe ser antes que la de fin.")).max(10)),
}).superRefine((d, ctx) => {
  if (d.signup_gift >= d.stamps_required) ctx.addIssue({ code: "custom", message: "Los sellos de regalo deben ser menos que los necesarios." });
  if ((d.reward_mid === null) !== (d.reward_mid_at === null)) ctx.addIssue({ code: "custom", message: "Para el premio intermedio indica el premio y en cuántos sellos." });
  if (d.reward_mid_at !== null && (d.reward_mid_at < 1 || d.reward_mid_at >= d.stamps_required)) ctx.addIssue({ code: "custom", message: "El premio intermedio debe estar antes del último sello." });
  if (d.valid_from && d.valid_until && d.valid_until < d.valid_from) ctx.addIssue({ code: "custom", message: "La vigencia termina antes de empezar." });
});

export async function saveConfigAction(businessId: string, _prev: unknown, formData: FormData) {
  const { sb } = await requireBusiness(businessId);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const d = parsed.data;
  // Con la sesión del dueño: la RLS y los permisos por columna aplican
  const b = await sb.from("businesses").update({
    name: d.name, primary_color: d.primary_color, secondary_color: d.secondary_color, stamp_icon: d.stamp_icon,
    avg_ticket_mxn: d.avg_ticket_mxn, at_risk_days: d.at_risk_days, frequent_min_visits: d.frequent_min_visits,
  }).eq("id", businessId).select("id");
  if (b.error || !b.data?.length) return { ok: false, error: "No se pudo guardar la marca." };
  const p = await sb.from("programs").update({
    stamps_required: d.stamps_required, signup_gift: d.signup_gift, reward_final: d.reward_final,
    reward_mid: d.reward_mid, reward_mid_at: d.reward_mid_at, valid_from: d.valid_from, valid_until: d.valid_until,
    restrictions: d.restrictions, cooldown_minutes: d.cooldown_minutes, double_rules: d.double_rules,
  }).eq("business_id", businessId).select("business_id");
  if (p.error || !p.data?.length) return { ok: false, error: "No se pudieron guardar las reglas." };
  revalidatePath(`/panel/${businessId}`, "layout");
  return { ok: true, error: null };
}

export async function uploadLogoAction(businessId: string, formData: FormData) {
  const { sb } = await requireBusiness(businessId);
  const file = formData.get("logo");
  if (!(file instanceof File)) return { ok: false as const, error: "Elige un archivo." };
  if (file.size > 1024 * 1024) return { ok: false as const, error: "El logo pesa más de 1 MB. Usa uno más ligero." };
  const processed = await processLogo(Buffer.from(await file.arrayBuffer()));
  if (!processed.ok) return { ok: false as const, error: processed.error };

  const path = `${businessId}/logo-${Date.now()}.png`;
  const storage = adminClient().storage.from("logos");
  const up = await storage.upload(path, processed.png, { contentType: "image/png", upsert: false });
  if (up.error) return { ok: false as const, error: "No se pudo guardar el logo." };
  const { data: prev } = await sb.from("businesses").select("logo_path").eq("id", businessId).single();
  const upd = await sb.from("businesses").update({ logo_path: path }).eq("id", businessId).select("id");
  if (upd.error || !upd.data?.length) {
    await storage.remove([path]);
    return { ok: false as const, error: "No se pudo guardar el logo." };
  }
  if (prev?.logo_path && prev.logo_path.startsWith(`${businessId}/`)) await storage.remove([prev.logo_path]);
  revalidatePath(`/panel/${businessId}`, "layout");
  return { ok: true as const, url: logoUrl(path)!, suggestion: processed.suggestion };
}
