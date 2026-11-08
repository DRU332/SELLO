import { NextResponse } from "next/server";
import { callRpc } from "@/lib/supabase/admin";
import type { CustomerCard } from "@/lib/types";

// Manifest de la tarjeta: al instalarla, la app abre directo en ESTA tarjeta.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return new NextResponse(null, { status: 404 });
  const card = await callRpc<CustomerCard | null>("get_customer_card", { p_token: token });
  if (!card) return new NextResponse(null, { status: 404 });
  const b = card.business;
  return NextResponse.json(
    {
      name: `${b.name} · Mi tarjeta`,
      short_name: b.name.slice(0, 12),
      start_url: `/t/${token}`,
      scope: `/t/${token}`,
      id: `/t/${token}`,
      display: "standalone",
      background_color: b.secondary_color,
      theme_color: b.primary_color,
      lang: "es-MX",
      icons: [
        { src: `/api/icono/${b.slug}?s=192`, sizes: "192x192", type: "image/png" },
        { src: `/api/icono/${b.slug}?s=512`, sizes: "512x512", type: "image/png" },
        { src: `/api/icono/${b.slug}?s=512&m=1`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "private, no-store" } },
  );
}
