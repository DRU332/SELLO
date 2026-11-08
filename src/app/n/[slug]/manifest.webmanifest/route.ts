import { NextResponse } from "next/server";
import { publicBusinessBySlug } from "@/lib/business";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await publicBusinessBySlug(slug);
  if (!b) return new NextResponse(null, { status: 404 });
  return NextResponse.json(
    {
      name: `${b.name} · Tarjeta de lealtad`,
      short_name: b.name.slice(0, 12),
      start_url: `/n/${slug}`,
      scope: `/`,
      display: "standalone",
      background_color: b.secondary_color,
      theme_color: b.primary_color,
      lang: "es-MX",
      icons: [
        { src: `/api/icono/${slug}?s=192`, sizes: "192x192", type: "image/png" },
        { src: `/api/icono/${slug}?s=512`, sizes: "512x512", type: "image/png" },
        { src: `/api/icono/${slug}?s=512&m=1`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
