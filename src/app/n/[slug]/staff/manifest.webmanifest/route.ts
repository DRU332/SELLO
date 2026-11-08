import { NextResponse } from "next/server";
import { publicBusinessBySlug } from "@/lib/business";

// Manifest de la pantalla de sellado: el negocio la instala en su celular o tableta.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await publicBusinessBySlug(slug);
  if (!b) return new NextResponse(null, { status: 404 });
  return NextResponse.json(
    {
      name: `Sellar · ${b.name}`,
      short_name: "Sellar",
      start_url: `/n/${slug}/sellar`,
      scope: `/n/${slug}/`,
      id: `/n/${slug}/sellar`,
      display: "standalone",
      orientation: "portrait",
      background_color: "#111827",
      theme_color: b.primary_color,
      lang: "es-MX",
      icons: [
        { src: `/api/icono/${slug}?s=192`, sizes: "192x192", type: "image/png" },
        { src: `/api/icono/${slug}?s=512`, sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
