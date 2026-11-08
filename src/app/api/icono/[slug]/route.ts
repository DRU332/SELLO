import { NextResponse } from "next/server";
import sharp from "sharp";
import { publicBusinessBySlug } from "@/lib/business";
import { brandTheme } from "@/lib/colors";
import { adminClient } from "@/lib/supabase/admin";

// Icono de la app (pantalla de inicio) con el logo y colores del negocio.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const size = [180, 192, 512].includes(Number(url.searchParams.get("s"))) ? Number(url.searchParams.get("s")) : 192;
  const maskable = url.searchParams.get("m") === "1";
  const b = await publicBusinessBySlug(slug);
  if (!b) return new NextResponse(null, { status: 404 });
  const t = brandTheme(b.primary_color, b.secondary_color);

  let logo: Buffer | null = null;
  if (b.logo_path) {
    const { data } = await adminClient().storage.from("logos").download(b.logo_path);
    if (data) logo = Buffer.from(await data.arrayBuffer());
  }

  const inner = Math.round(size * (maskable ? 0.56 : 0.72));
  const base = sharp({ create: { width: size, height: size, channels: 4, background: t.background } });
  let layer: Buffer;
  if (logo) {
    layer = await sharp(logo).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  } else {
    const initials = b.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
      .replace(/[<>&"']/g, "");
    layer = await sharp(Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}"><rect width="100%" height="100%" rx="${inner * 0.22}" fill="${t.primary}"/><text x="50%" y="54%" font-family="Arial, sans-serif" font-weight="700" font-size="${inner * 0.42}" fill="${t.onPrimary}" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`,
    )).png().toBuffer();
  }
  const png = await base.composite([{ input: layer, gravity: "center" }]).png().toBuffer();
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
