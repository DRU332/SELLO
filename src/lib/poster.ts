import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import { brandTheme, hexToRgb } from "@/lib/colors";
import { describeConditions } from "@/lib/program";
import { qrPng } from "@/lib/qr";
import type { Program } from "@/lib/types";

const color = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return rgb(r / 255, g / 255, b / 255);
};

/** Quita caracteres que las fuentes estándar del PDF no pueden dibujar (emojis, flechas…). */
function safe(font: PDFFont, text: string) {
  return [...text].map((ch) => { try { font.encodeText(ch); return ch; } catch { return ""; } }).join("");
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = safe(font, text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildPoster(opts: {
  name: string; url: string; primary: string; secondary: string; logoPng: Buffer | null; program: Program; timezone: string;
}) {
  const t = brandTheme(opts.primary, opts.secondary);
  const doc = await PDFDocument.create();
  doc.setTitle(`Cartel QR · ${opts.name}`);
  doc.setLanguage("es-MX");
  const page = doc.addPage([612, 792]); // carta
  const { width, height } = page.getSize();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const center = (text: string, y: number, size: number, font: PDFFont, c = color(t.text)) => {
    const s = safe(font, text);
    page.drawText(s, { x: (width - font.widthOfTextAtSize(s, size)) / 2, y, size, font, color: c });
  };

  page.drawRectangle({ x: 0, y: 0, width, height, color: color(t.background) });
  page.drawRectangle({ x: 0, y: height - 190, width, height: 190, color: color(t.primary) });

  if (opts.logoPng) {
    const img = await doc.embedPng(opts.logoPng);
    page.drawRectangle({ x: width / 2 - 62, y: height - 162, width: 124, height: 124, color: rgb(1, 1, 1) });
    page.drawImage(img, { x: width / 2 - 56, y: height - 156, width: 112, height: 112 });
  }
  center(opts.name, height - 182 + (opts.logoPng ? 0 : 80), opts.logoPng ? 14 : 34, bold, color(t.onPrimary));

  center("¡Junta sellos y gana!", height - 240, 34, bold);
  const p = opts.program;
  const rewardLines = wrap(bold, `Con ${p.stamps_required} sellos: ${p.reward_final}`, 18, width - 120);
  rewardLines.forEach((l, i) => center(l, height - 272 - i * 22, 18, bold, color(t.accent)));
  let y = height - 272 - rewardLines.length * 22;
  if (p.signup_gift > 0) center(`Regístrate y recibe ${p.signup_gift} sellos de regalo`, y - 4, 14, regular);

  const qrSize = 250;
  const qr = await doc.embedPng(await qrPng(opts.url, 1000));
  const qrY = y - 30 - qrSize;
  page.drawRectangle({ x: (width - qrSize) / 2 - 14, y: qrY - 14, width: qrSize + 28, height: qrSize + 28, color: rgb(1, 1, 1), borderColor: color(t.primary), borderWidth: 6 });
  page.drawImage(qr, { x: (width - qrSize) / 2, y: qrY, width: qrSize, height: qrSize });
  center("Escanea con la cámara de tu celular", qrY - 40, 18, bold);
  center("Sin descargar apps · Sin contraseñas · Gratis", qrY - 60, 12, regular);

  y = qrY - 96;
  const steps = ["1. Escanea el código.", "2. Escribe tu nombre y WhatsApp.", "3. En cada compra, muestra tu código en caja."];
  steps.forEach((s, i) => center(s, y - i * 18, 13, regular));
  y -= steps.length * 18 + 10;

  const conds = describeConditions(p, opts.timezone).slice(1).join(" ");
  const condLines = wrap(regular, conds, 8.5, width - 100).slice(0, 5);
  condLines.forEach((l, i) => center(l, y - i * 11, 8.5, regular, color(t.muted)));
  center(opts.url.replace(/^https?:\/\//, ""), 22, 9, regular, color(t.muted));

  return Buffer.from(await doc.save());
}
