import { APP_TIMEZONE } from "@/lib/env";

const mxnFmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("es-MX");

export const mxn = (n: number | string | null | undefined) => mxnFmt.format(Number(n ?? 0));
export const num = (n: number | string | null | undefined) => numFmt.format(Number(n ?? 0));

export function dateTime(d: string | Date | null | undefined, tz = APP_TIMEZONE) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: tz, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export function dateOnly(d: string | Date | null | undefined, tz = APP_TIMEZONE) {
  if (!d) return "—";
  const value = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`) : new Date(d);
  return new Intl.DateTimeFormat("es-MX", { timeZone: tz, day: "numeric", month: "long", year: "numeric" }).format(value);
}

/** Fecha local (YYYY-MM-DD) en la zona del negocio. */
export function localDate(d: Date = new Date(), tz = APP_TIMEZONE) {
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}

export function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

export function monthName(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const s = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 15)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function relativeDays(d: string | Date | null | undefined) {
  if (!d) return "nunca";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}
