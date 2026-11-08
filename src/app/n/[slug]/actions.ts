"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentVersions } from "@/lib/legal";
import { errorMessage } from "@/lib/messages";
import { normalizeMxPhone } from "@/lib/phone";
import { clientIpHash, userAgent } from "@/lib/request";
import { cardCookieName } from "@/lib/staff-session";
import { callRpc } from "@/lib/supabase/admin";

export type RegisterState = { error?: string; code?: string; fields?: Record<string, string> } | null;

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  name: z.string().trim().min(2, "Escribe tu nombre (mínimo 2 letras).").max(60, "El nombre es muy largo."),
  phone: z.string().transform((v, ctx) => {
    const n = normalizeMxPhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Escribe un número de WhatsApp de 10 dígitos." });
    return n ?? "";
  }),
  birthday: z.string().optional().transform((v) => (v ? v : null))
    .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v) < new Date() && new Date(v) > new Date("1900-01-01")),
      "La fecha de cumpleaños no es válida."),
  privacy: z.literal("on", { message: "Para continuar debes aceptar el aviso de privacidad y los términos." }),
  marketing: z.string().optional(),
});

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = schema.safeParse(raw);
  const fields = { name: raw.name ?? "", phone: raw.phone ?? "", birthday: raw.birthday ?? "" };
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa tus datos.", fields };
  }
  const d = parsed.data;
  const versions = await currentVersions();
  const result = await callRpc<{ ok: boolean; error?: string; token?: string }>("register_customer", {
    p_slug: d.slug,
    p_name: d.name,
    p_phone: d.phone,
    p_birthday: d.birthday,
    p_privacy_accepted: d.privacy === "on",
    p_privacy_version: versions.privacy,
    p_terms_version: versions.terms,
    p_marketing: d.marketing === "on",
    p_ip_hash: await clientIpHash(),
    p_user_agent: await userAgent(),
  });
  if (!result.ok || !result.token) {
    return { error: errorMessage(result.error), code: result.error, fields };
  }
  (await cookies()).set(cardCookieName(d.slug), result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  redirect(`/t/${result.token}?bienvenida=1`);
}
