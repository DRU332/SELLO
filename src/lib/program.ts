import { dateOnly } from "@/lib/format";
import type { DoubleRule, Program } from "@/lib/types";

export const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function joinEs(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}

export function describeDays(days: number[]) {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return "todos los días";
  if (sorted.join() === "1,2,3,4,5") return "de lunes a viernes";
  if (sorted.join() === "0,6") return "sábados y domingos";
  return joinEs(sorted.map((d) => (d === 0 || d === 6 ? `${DAY_NAMES[d]}s` : DAY_NAMES[d])));
}

export function describeDoubleRule(r: DoubleRule) {
  const allDay = r.from === "00:00" && (r.to === "24:00" || r.to === "23:59");
  return `Doble sello ${describeDays(r.days)}${allDay ? "" : ` de ${r.from} a ${r.to} h`}`;
}

/** Condiciones que SIEMPRE se muestran en la tarjeta. */
export function describeConditions(p: Program, tz?: string): string[] {
  const lines: string[] = [];
  lines.push(`Junta ${p.stamps_required} sellos y recibe: ${p.reward_final}.`);
  if (p.reward_mid && p.reward_mid_at) lines.push(`Premio a los ${p.reward_mid_at} sellos: ${p.reward_mid}.`);
  if (p.signup_gift > 0) lines.push(`Al registrarte recibes ${p.signup_gift} ${p.signup_gift === 1 ? "sello" : "sellos"} de regalo.`);
  lines.push(
    p.cooldown_minutes > 0
      ? `1 sello por visita con compra; mínimo ${formatMinutes(p.cooldown_minutes)} entre sellos.`
      : "1 sello por visita con compra.",
  );
  for (const r of p.double_rules ?? []) lines.push(`${describeDoubleRule(r)}.`);
  if (p.valid_from && p.valid_until) lines.push(`Vigencia: del ${dateOnly(p.valid_from, tz)} al ${dateOnly(p.valid_until, tz)}.`);
  else if (p.valid_until) lines.push(`Vigencia: hasta el ${dateOnly(p.valid_until, tz)}.`);
  else if (p.valid_from) lines.push(`Vigente a partir del ${dateOnly(p.valid_from, tz)}.`);
  if (p.restrictions?.trim()) lines.push(p.restrictions.trim());
  lines.push("Premios no canjeables por dinero. Tarjeta personal e intransferible.");
  return lines;
}

export function formatMinutes(min: number) {
  if (min < 60) return `${min} minutos`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = `${h} ${h === 1 ? "hora" : "horas"}`;
  return m ? `${hs} ${m} min` : hs;
}

export function stampsWord(n: number) {
  return `${n} ${n === 1 ? "sello" : "sellos"}`;
}
