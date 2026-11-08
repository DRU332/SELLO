import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { dateTime } from "@/lib/format";
import { formatMxPhone } from "@/lib/phone";
import { createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new NextResponse("No encontrado", { status: 404 });
  const sb = await createUserClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });
  // La RLS garantiza que solo se lean clientes de negocios propios
  const { data: business } = await sb.from("businesses").select("slug, timezone").eq("id", id).maybeSingle();
  if (!business) return new NextResponse("No encontrado", { status: 404 });

  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("customer_summary")
      .select("name, phone, birthday, marketing_opt_in, created_at, last_visit_at, visits, current_stamps, rewards_redeemed")
      .eq("business_id", id).is("deleted_at", null).order("created_at").range(from, from + 999);
    if (error) return new NextResponse("Error", { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const csv = toCsv(
    ["Nombre", "WhatsApp", "Cumpleaños", "Acepta promociones", "Registro", "Visitas", "Última visita", "Sellos actuales", "Premios canjeados"],
    rows.map((r) => [
      r.name as string, formatMxPhone(r.phone as string), (r.birthday as string) ?? "", r.marketing_opt_in ? "Sí" : "No",
      dateTime(r.created_at as string, business.timezone), r.visits as number,
      r.last_visit_at ? dateTime(r.last_visit_at as string, business.timezone) : "", r.current_stamps as number, r.rewards_redeemed as number,
    ]),
  );
  const date = new Date().toLocaleDateString("en-CA", { timeZone: business.timezone });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${business.slug}-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
