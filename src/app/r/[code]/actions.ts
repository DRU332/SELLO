"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clientIpHash } from "@/lib/request";
import { cardCookieName } from "@/lib/staff-session";
import { callRpc } from "@/lib/supabase/admin";

export async function claimRecoveryAction(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(code)) redirect(`/r/x?error=1`);
  const r = await callRpc<{ ok: boolean; token?: string; slug?: string }>("claim_recovery_code", {
    p_code: code,
    p_ip_hash: await clientIpHash(),
  });
  if (!r.ok || !r.token || !r.slug) redirect(`/r/${code}?error=1`);
  (await cookies()).set(cardCookieName(r.slug), r.token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 400,
  });
  redirect(`/t/${r.token}`);
}
