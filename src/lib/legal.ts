import "server-only";
import { adminClient } from "@/lib/supabase/admin";

export type LegalDoc = { kind: "privacy" | "terms"; version: string; title: string; body: string; is_draft: boolean; created_at: string };

export async function currentLegal(kind: "privacy" | "terms"): Promise<LegalDoc> {
  const { data, error } = await adminClient()
    .from("legal_documents")
    .select("kind, version, title, body, is_draft, created_at")
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) throw new Error("No hay documento legal configurado");
  return data as LegalDoc;
}

export async function currentVersions() {
  const [p, t] = await Promise.all([currentLegal("privacy"), currentLegal("terms")]);
  return { privacy: p.version, terms: t.version };
}

export function renderLegalBody(body: string, businessName: string) {
  return body.replaceAll("{{negocio}}", businessName);
}
