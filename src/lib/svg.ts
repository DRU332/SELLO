// Validación estricta de SVG antes de convertirlo a PNG.
// El SVG original nunca se publica: se rasteriza a PNG en el servidor.
const FORBIDDEN = [
  /<script/i,
  /<foreignObject/i,
  /<!ENTITY/i,
  /<!DOCTYPE/i,
  /<iframe/i,
  /<embed/i,
  /<object/i,
  /\son[a-z]+\s*=/i, // onload=, onclick=…
  /javascript:/i,
  /<\?xml-stylesheet/i,
  /@import/i,
];

export function validateSvg(text: string): { ok: true } | { ok: false; reason: string } {
  if (!/<svg[\s>]/i.test(text)) return { ok: false, reason: "El archivo no parece un SVG válido." };
  for (const re of FORBIDDEN) {
    if (re.test(text)) return { ok: false, reason: "El SVG contiene código o elementos no permitidos." };
  }
  // Solo se permiten referencias internas (#id) o imágenes embebidas.
  const hrefs = text.match(/(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi) ?? [];
  for (const h of hrefs) {
    const value = h.replace(/^[^=]*=\s*["']/, "").replace(/["']$/, "").trim();
    if (!value.startsWith("#") && !/^data:image\/(png|jpeg);base64,/i.test(value)) {
      return { ok: false, reason: "El SVG enlaza archivos externos, que no están permitidos." };
    }
  }
  if (/url\(\s*["']?(?!#)/i.test(text)) {
    return { ok: false, reason: "El SVG enlaza recursos externos, que no están permitidos." };
  }
  return { ok: true };
}

export type ImageKind = "png" | "jpeg" | "svg";

/** Detecta el tipo real del archivo por su contenido (no por la extensión). */
export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  const head = buf.subarray(0, 2048).toString("utf8").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) return "svg";
  return null;
}
