import "server-only";
import { notFound, redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import type { Program } from "@/lib/types";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function currentUser() {
  const sb = await createUserClient();
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}

export async function requireUser() {
  const { sb, user } = await currentUser();
  if (!user) redirect("/entrar");
  return { sb, user };
}

export async function isPlatformAdmin(sb: Awaited<ReturnType<typeof createUserClient>>) {
  const { data } = await sb.rpc("is_platform_admin");
  return data === true;
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (!(await isPlatformAdmin(ctx.sb))) redirect("/panel");
  return ctx;
}

export type OwnerBusiness = {
  id: string;
  slug: string;
  name: string;
  status: "trial" | "active" | "suspended";
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
  stamp_icon: string;
  avg_ticket_mxn: number;
  timezone: string;
  at_risk_days: number;
  frequent_min_visits: number;
  trial_ends_at: string | null;
};

/** Verifica (con RLS) que el usuario puede ver este negocio. */
export async function requireBusiness(businessId: string) {
  if (!UUID_RE.test(businessId)) notFound();
  const { sb, user } = await requireUser();
  const [{ data: business }, { data: program }, admin] = await Promise.all([
    sb.from("businesses").select("*").eq("id", businessId).maybeSingle(),
    sb.from("programs").select("*").eq("business_id", businessId).maybeSingle(),
    isPlatformAdmin(sb),
  ]);
  if (!business || !program) notFound();
  return { sb, user, business: business as OwnerBusiness, program: program as Program, isAdmin: admin };
}
