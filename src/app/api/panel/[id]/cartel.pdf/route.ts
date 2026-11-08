import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/auth";
import { businessUrl } from "@/lib/brand";
import { buildPoster } from "@/lib/poster";
import { adminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";
import type { Program } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new NextResponse("No encontrado", { status: 404 });
  const sb = await createUserClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });
  const [{ data: b }, { data: program }] = await Promise.all([
    sb.from("businesses").select("slug, name, primary_color, secondary_color, logo_path, timezone").eq("id", id).maybeSingle(),
    sb.from("programs").select("*").eq("business_id", id).maybeSingle(),
  ]);
  if (!b || !program) return new NextResponse("No encontrado", { status: 404 });
  let logo: Buffer | null = null;
  if (b.logo_path) {
    const { data } = await adminClient().storage.from("logos").download(b.logo_path);
    if (data) logo = Buffer.from(await data.arrayBuffer());
  }
  const pdf = await buildPoster({
    name: b.name, url: businessUrl(b.slug), primary: b.primary_color, secondary: b.secondary_color,
    logoPng: logo, program: program as Program, timezone: b.timezone,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cartel-${b.slug}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
