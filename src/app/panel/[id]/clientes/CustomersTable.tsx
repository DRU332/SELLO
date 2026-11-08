"use client";

import { useState } from "react";
import { formatMxPhone, waLink } from "@/lib/phone";

export type CustomerRow = {
  id: string; name: string; phone: string | null; birthday: string | null; marketing_opt_in: boolean;
  created_at: string; last_visit_at: string | null; visits: number; current_stamps: number; rewards_redeemed: number;
};

export function CustomersTable({ rows, businessName, stampsRequired, reward, timezone }: {
  rows: CustomerRow[]; businessName: string; stampsRequired: number; reward: string; timezone: string;
}) {
  const [template, setTemplate] = useState(
    `¡Hola {nombre}! En ${businessName} tenemos una promoción para ti. Llevas {sellos} de ${stampsRequired} sellos para ${reward}. ¡Te esperamos!`,
  );
  const fmt = (d: string | null) => d
    ? new Intl.DateTimeFormat("es-MX", { timeZone: timezone, day: "numeric", month: "short", year: "2-digit" }).format(new Date(d))
    : "—";
  const message = (c: CustomerRow) => template.replaceAll("{nombre}", c.name.split(" ")[0]).replaceAll("{sellos}", String(c.current_stamps));
  const optedIn = rows.filter((r) => r.marketing_opt_in).length;

  return (
    <>
      <details className="card">
        <summary className="cursor-pointer font-semibold">Mensaje para WhatsApp ({optedIn} clientes aceptaron promociones)</summary>
        <p className="mt-2 text-sm text-stone-600">
          Usa <code>{"{nombre}"}</code> y <code>{"{sellos}"}</code>. El botón abre WhatsApp con el mensaje listo; tú decides si lo envías.
          Solo aparece para clientes que aceptaron recibir promociones.
        </p>
        <textarea className="field mt-2 h-24" value={template} onChange={(e) => setTemplate(e.target.value)} maxLength={600} />
      </details>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Nombre</th><th className="px-3">WhatsApp</th><th className="px-3 text-right">Visitas</th>
              <th className="px-3 text-right">Sellos</th><th className="px-3">Última visita</th><th className="px-3">Registro</th><th className="px-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-stone-500">Sin clientes.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-stone-100">
                <td className="px-3 py-2 font-medium">{c.name}{c.rewards_redeemed > 0 && <span className="ml-1 text-xs text-emerald-700">· {c.rewards_redeemed} premio{c.rewards_redeemed > 1 ? "s" : ""}</span>}</td>
                <td className="whitespace-nowrap px-3">{formatMxPhone(c.phone)}</td>
                <td className="px-3 text-right tabular-nums">{c.visits}</td>
                <td className="px-3 text-right tabular-nums">{c.current_stamps}/{stampsRequired}</td>
                <td className="whitespace-nowrap px-3">{fmt(c.last_visit_at)}</td>
                <td className="whitespace-nowrap px-3">{fmt(c.created_at)}</td>
                <td className="px-3 text-right">
                  {c.marketing_opt_in && c.phone ? (
                    <a href={waLink(message(c), c.phone)} target="_blank" rel="noopener noreferrer"
                      className="inline-block rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-semibold text-stone-950">WhatsApp</a>
                  ) : <span className="text-xs text-stone-400">Sin permiso</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
