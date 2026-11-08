"use server";

import { redirect } from "next/navigation";
import { errorMessage } from "@/lib/messages";
import { clientIpHash } from "@/lib/request";
import { clearStaffToken, getStaffToken, setStaffToken } from "@/lib/staff-session";
import { callRpc } from "@/lib/supabase/admin";

export async function staffLoginAction(slug: string, pin: string) {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return { error: "Negocio inválido." };
  if (!/^\d{4,6}$/.test(pin)) return { error: "El PIN debe tener de 4 a 6 números." };
  const r = await callRpc<{ ok: boolean; error?: string; token?: string }>("staff_login", {
    p_slug: slug,
    p_pin: pin,
    p_ip_hash: await clientIpHash(),
  });
  if (!r.ok || !r.token) return { error: errorMessage(r.error) };
  await setStaffToken(r.token);
  redirect(`/n/${slug}/sellar`);
}

export async function staffLogoutAction(slug: string) {
  const token = await getStaffToken();
  if (token) await callRpc("staff_logout", { p_session: token });
  await clearStaffToken();
  redirect(`/n/${slug}/staff`);
}
