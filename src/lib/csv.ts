/** CSV compatible con Excel (BOM UTF-8) y protegido contra inyección de fórmulas. */
export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const esc = (v: string | number | boolean | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
