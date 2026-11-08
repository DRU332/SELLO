// Colores de marca con contraste legible garantizado (WCAG).

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-f]{6}$/.test(v);
}

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const DARK = "#111827";
const LIGHT = "#ffffff";

/** Texto blanco o casi negro, el que se lea mejor sobre el fondo. */
export function textOn(bg: string) {
  const best = contrast(bg, LIGHT) >= contrast(bg, DARK) ? LIGHT : DARK;
  if (contrast(bg, best) >= 4.5) return best;
  // Con negro puro o blanco siempre se alcanza al menos 4.58:1
  return contrast(bg, "#000000") >= contrast(bg, LIGHT) ? "#000000" : LIGHT;
}

function mix(hex: string, target: string, t: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB);
}

/** Oscurece o aclara `fg` lo mínimo necesario para alcanzar el contraste pedido sobre `bg`. */
export function ensureContrast(fg: string, bg: string, min: number) {
  if (contrast(fg, bg) >= min) return fg;
  const towards = luminance(bg) > 0.4 ? "#000000" : "#ffffff";
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(fg, towards, t);
    if (contrast(c, bg) >= min) return c;
  }
  return towards === "#000000" ? DARK : LIGHT;
}

export type BrandTheme = {
  primary: string; // color principal (franja, sellos)
  onPrimary: string; // texto sobre el principal
  background: string; // fondo de la tarjeta (color secundario)
  text: string; // texto sobre el fondo
  accent: string; // principal ajustado para leerse sobre el fondo
  muted: string;
};

/** Tema derivado de los colores del negocio, siempre con contraste suficiente. */
export function brandTheme(primary: string, secondary: string): BrandTheme {
  const p = isHexColor(primary) ? primary : "#7c2d12";
  let bg = isHexColor(secondary) ? secondary : "#fef3c7";
  // Fondo y color principal deben distinguirse (≥ 3:1) para que los sellos se vean.
  if (contrast(p, bg) < 3) bg = ensureContrast(bg, p, 3);
  const text = textOn(bg);
  return {
    primary: p,
    onPrimary: textOn(p),
    background: bg,
    text,
    accent: ensureContrast(p, bg, 4.5),
    muted: mix(text, bg, 0.35),
  };
}

export type ContrastReport = { label: string; ratio: number; ok: boolean }[];

export function contrastReport(primary: string, secondary: string): ContrastReport {
  const t = brandTheme(primary, secondary);
  return [
    { label: "Texto sobre color principal", ratio: contrast(t.onPrimary, t.primary), ok: contrast(t.onPrimary, t.primary) >= 4.5 },
    { label: "Texto sobre el fondo", ratio: contrast(t.text, t.background), ok: contrast(t.text, t.background) >= 4.5 },
    { label: "Sellos sobre el fondo", ratio: contrast(t.primary, t.background), ok: contrast(t.primary, t.background) >= 3 },
  ];
}

// ---------------------------------------------------------------------------
// Sugerencia de colores a partir de los píxeles del logo
// ---------------------------------------------------------------------------
function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

/**
 * Recibe píxeles RGBA y propone color principal y secundario.
 * Ignora transparencias y fondos blancos; prefiere colores saturados.
 */
export function suggestColorsFromPixels(rgba: Uint8Array | Buffer, channels = 4): { primary: string; secondary: string; palette: string[] } {
  const buckets = new Map<string, { n: number; sum: [number, number, number] }>();
  for (let i = 0; i < rgba.length; i += channels) {
    const a = channels === 4 ? rgba[i + 3] : 255;
    if (a < 160) continue;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const [, s, l] = rgbToHsl([r, g, b]);
    if (l > 0.93 || (l > 0.85 && s < 0.15)) continue; // fondo blanco
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const e = buckets.get(key) ?? { n: 0, sum: [0, 0, 0] };
    e.n += 1;
    e.sum[0] += r; e.sum[1] += g; e.sum[2] += b;
    buckets.set(key, e);
  }
  const colors = [...buckets.values()]
    .map((e) => {
      const rgb: RGB = [e.sum[0] / e.n, e.sum[1] / e.n, e.sum[2] / e.n];
      const [h, s, l] = rgbToHsl(rgb);
      // Peso: frecuencia, con bonificación a colores saturados de luminosidad media
      const score = e.n * (0.35 + s) * (l < 0.08 ? 0.5 : 1);
      return { hex: rgbToHex(rgb), h, s, l, score };
    })
    .sort((a, b) => b.score - a.score);

  // Paleta con colores distintos entre sí
  const palette: typeof colors = [];
  for (const c of colors) {
    if (palette.every((p) => Math.abs(p.h - c.h) > 25 || Math.abs(p.l - c.l) > 0.25)) palette.push(c);
    if (palette.length >= 5) break;
  }
  const primary = palette[0]?.hex ?? "#7c2d12";
  // Secundario: tono muy claro del principal (fondo cálido y legible)
  const secondary = mix(primary, "#ffffff", 0.88);
  return { primary, secondary, palette: palette.map((p) => p.hex) };
}
