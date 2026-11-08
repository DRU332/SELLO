"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentVersions } from "@/lib/legal";
import { clientIpHash, userAgent } from "@/lib/request";
import { cardCookieName } from "@/lib/staff-session";
import { callRpc } from "@/lib/supabase/admin";
import type { CustomerCard } from "@/lib/types";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,80}$/;

export async function setMarketingAction(token: string, optIn: boolean) {
  if (!TOKEN_RE.test(token)) return { ok: false };
  const versions = await currentVersions();
  return callRpc("customer_set_marketing", {
    p_token: token,
    p_opt_in: Boolean(optIn),
    p_version: versions.privacy,
    p_ip_hash: await clientIpHash(),
    p_user_agent: await userAgent(),
  });
}

export async function deleteAccountAction(token: string) {
  if (!TOKEN_RE.test(token)) return { ok: false };
  const card = await callRpc<CustomerCard | null>("get_customer_card", { p_token: token });
  if (!card) return { ok: false };
  const versions = await currentVersions();
  await callRpc("customer_delete", {
    p_token: token,
    p_version: versions.privacy,
    p_ip_hash: await clientIpHash(),
    p_user_agent: await userAgent(),
  });
  (await cookies()).delete(cardCookieName(card.business.slug));
  redirect(`/n/${card.business.slug}?baja=1`);
}
