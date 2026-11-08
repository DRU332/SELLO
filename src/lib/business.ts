import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { PublicBusiness } from "@/lib/types";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Datos públicos del negocio (marca y reglas). Nunca incluye datos de clientes. */
export async function publicBusinessBySlug(slug: string): Promise<PublicBusiness | null> {
  if (!SLUG_RE.test(slug)) return null;
  const { data } = await adminClient()
    .from("businesses")
    .select("id, slug, name, status, logo_path, primary_color, secondary_color, stamp_icon, timezone, programs(*)")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const program = Array.isArray(data.programs) ? data.programs[0] : data.programs;
  const { programs: _omit, ...rest } = data as typeof data & { programs: unknown };
  void _omit;
  return { ...(rest as Omit<PublicBusiness, "program">), program } as PublicBusiness;
}
