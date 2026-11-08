/** Convierte un número mexicano a formato +52XXXXXXXXXX (10 dígitos). */
export function normalizeMxPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("521")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("52")) digits = digits.slice(2);
  if (digits.length !== 10) return null;
  if (/^(\d)\1{9}$/.test(digits)) return null; // 0000000000, 1111111111…
  return `+52${digits}`;
}

/** +523312345678 → 33 1234 5678 */
export function formatMxPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const d = e164.replace(/^\+52/, "");
  if (d.length !== 10) return e164;
  return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
}

/** Enlace wa.me con mensaje prellenado. Sin número: el usuario elige el chat. */
export function waLink(text: string, e164?: string | null): string {
  const base = e164 ? `https://wa.me/${e164.replace(/\D/g, "")}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
