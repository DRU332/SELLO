import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { localDate, monthBounds, monthName, mxn, num, relativeDays, shiftMonth } from "@/lib/format";
import { formatMxPhone, waLink } from "@/lib/phone";

type Report = {
  total_customers: number; new_customers: number; visits: number; returning_visits: number;
  returning_customers: number; redemptions: number; gift_stamps: number; avg_ticket_mxn: number; estimated_sales_mxn: number;
};

type Risk = { id: string; name: string; phone: string | null; marketing_opt_in: boolean; visits: number; last_visit_at: string; current_stamps: number };

export default async function Summary({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { id } = await params;
  const { mes } = await searchParams;
  const { sb, business, program } = await requireBusiness(id);
  const thisMonth = localDate(new Date(), business.timezone).slice(0, 7);
  const month = mes && /^\d{4}-\d{2}$/.test(mes) && mes <= thisMonth ? mes : thisMonth;
  const isCurrent = month === thisMonth;
  const { from, to } = monthBounds(month);

  const last6 = Array.from({ length: 6 }, (_, i) => shiftMonth(month, -i));
  const [reports, { data: risk }] = await Promise.all([
    Promise.all(last6.map(async (m) => {
      const b = monthBounds(m);
      const { data } = await sb.rpc("business_report", { p_business_id: id, p_from: b.from, p_to: b.to });
      return [m, data as Report] as const;
    })),
    sb.rpc("at_risk_customers", { p_business_id: id }),
  ]);
  const r = reports[0][1];
  void from; void to;

  const monthLabel = monthName(month);
  const monthLower = monthLabel.charAt(0).toLowerCase() + monthLabel.slice(1);
  const reportText = isCurrent
    ? `Este mes regresaron ${num(r.returning_customers)} clientes con tu tarjeta. Calculamos ${mxn(r.estimated_sales_mxn)} en ventas estimadas.`
    : `En ${monthLower} regresaron ${num(r.returning_customers)} clientes con tu tarjeta. Calculamos ${mxn(r.estimated_sales_mxn)} en ventas estimadas.`;
  const shareText = `${reportText}\n— Reporte de ${business.name} (Sellos)`;
  const riskList = (risk ?? []) as Risk[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{monthLabel}</h1>
        <div className="flex gap-2">
          <Link href={`?mes=${shiftMonth(month, -1)}`} className="btn-secondary px-3 py-2 text-sm">← Mes anterior</Link>
          {!isCurrent && <Link href={`?mes=${shiftMonth(month, 1)}`} className="btn-secondary px-3 py-2 text-sm">Mes siguiente →</Link>}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Indicadores del mes">
        <Kpi label="Clientes registrados" value={num(r.total_customers)} hint={`+${num(r.new_customers)} nuevos en el mes`} />
        <Kpi label="Visitas" value={num(r.visits)} hint="Sin contar sellos de regalo" />
        <Kpi label="Clientes que regresaron" value={num(r.returning_customers)} hint={`${num(r.returning_visits)} visitas de regreso`} />
        <Kpi label="Premios canjeados" value={num(r.redemptions)} />
        <Kpi label="Ventas estimadas" value={mxn(r.estimated_sales_mxn)} badge="estimado"
          hint={Number(business.avg_ticket_mxn) > 0 ? `${num(r.returning_visits)} × ticket de ${mxn(business.avg_ticket_mxn)}` : "Captura tu ticket promedio"} />
      </section>

      <section className="card" style={{ borderColor: business.primary_color }} data-testid="monthly-report">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Reporte mensual</h2>
        <p className="mt-2 text-xl font-semibold leading-snug">{reportText}</p>
        <p className="mt-1 text-xs text-stone-500">
          Estimado: visitas de clientes que regresaron × ticket promedio que capturaste. No es una cifra contable.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={waLink(shareText)} target="_blank" rel="noopener noreferrer" className="btn bg-[#25D366] text-stone-950">
            Compartir por WhatsApp
          </a>
          {Number(business.avg_ticket_mxn) === 0 && (
            <Link href={`/panel/${id}/configuracion#ticket`} className="btn-secondary">Capturar ticket promedio</Link>
          )}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold">Clientes en riesgo</h2>
          <p className="text-sm text-stone-500">
            Venían seguido ({program ? `${business.frequent_min_visits}+ visitas` : ""}) y no regresan desde hace {business.at_risk_days} días o más.
          </p>
          <ul className="mt-3 divide-y divide-stone-100" data-testid="at-risk">
            {riskList.length === 0 && <li className="py-3 text-sm text-stone-500">¡Nadie en riesgo! 🎉</li>}
            {riskList.slice(0, 15).map((c) => {
              const remaining = Math.max(0, program.stamps_required - Number(c.current_stamps));
              const msg = `¡Hola ${c.name.split(" ")[0]}! Te extrañamos en ${business.name}. Llevas ${c.current_stamps} de ${program.stamps_required} sellos: te ${remaining === 1 ? "falta 1" : `faltan ${remaining}`} para ${program.reward_final}. ¡Te esperamos!`;
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-xs text-stone-500">{c.visits} visitas · última {relativeDays(c.last_visit_at)}</p>
                  </div>
                  {c.marketing_opt_in && c.phone ? (
                    <a href={waLink(msg, c.phone)} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-stone-950" title={formatMxPhone(c.phone)}>
                      WhatsApp
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-stone-400">No aceptó promociones</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <h2 className="font-semibold">Últimos 6 meses</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-stone-500">
              <tr><th className="py-1">Mes</th><th className="px-2 text-right">Visitas</th><th className="px-2 text-right">Regresaron</th><th className="pl-2 text-right">Ventas (estimado)</th></tr>
            </thead>
            <tbody>
              {reports.map(([m, rep]) => (
                <tr key={m} className="border-t border-stone-100">
                  <td className="py-2 pr-2">{monthName(m)}</td>
                  <td className="px-2 text-right tabular-nums">{num(rep.visits)}</td>
                  <td className="px-2 text-right tabular-nums">{num(rep.returning_customers)}</td>
                  <td className="text-right tabular-nums">{mxn(rep.estimated_sales_mxn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, badge }: { label: string; value: string; hint?: string; badge?: string }) {
  return (
    <div className="card">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
        {badge && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">{badge}</span>}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
