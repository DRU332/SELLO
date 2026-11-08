import "server-only";
import sharp from "sharp";
import { suggestColorsFromPixels } from "@/lib/colors";
import { LOGO_MAX_BYTES } from "@/lib/env";
import { sniffImage, validateSvg } from "@/lib/svg";

export type ProcessedLogo =
  | { ok: true; png: Buffer; suggestion: { primary: string; secondary: string; palette: string[] } }
  | { ok: false; error: string };

/**
 * Valida y normaliza el logo: PNG, JPG o SVG (sanitizado) → PNG de 512 px.
 * Se eliminan metadatos y cualquier contenido activo.
 */
export async function processLogo(input: Buffer): Promise<ProcessedLogo> {
  if (input.length === 0) return { ok: false, error: "El archivo está vacío." };
  if (input.length > LOGO_MAX_BYTES) return { ok: false, error: "El logo pesa más de 1 MB. Usa uno más ligero." };
  const kind = sniffImage(input);
  if (!kind) return { ok: false, error: "Formato no permitido. Sube un PNG, JPG o SVG." };

  if (kind === "svg") {
    const check = validateSvg(input.toString("utf8"));
    if (!check.ok) return { ok: false, error: check.reason };
  }

  try {
    const img = sharp(input, { density: kind === "svg" ? 300 : undefined, limitInputPixels: 40_000_000 });
    const png = await img
      .rotate()
      .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const { data, info } = await sharp(png).resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { ok: true, png, suggestion: suggestColorsFromPixels(data, info.channels) };
  } catch {
    return { ok: false, error: "No pudimos leer la imagen. Prueba con otro archivo." };
  }
}
