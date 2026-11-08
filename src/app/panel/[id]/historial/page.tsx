import { requireBusiness } from "@/lib/auth";
import { dateTime } from "@/lib/format";

type Ev = { id: string; created_at: string; kind: string; amount: number; is_double: boolean; staff_name: string | null; undone_at: string | null; customer_id: string };

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, business } = await requireBusiness(id);
  const [{ data: events }, { data: reds }, { data: customers }] = await Promise.all([
    sb.from("stamp_events").select("id, created_at, kind, amount, is_double, staff_name, undone_at, customer_id")
      .eq("business_id", id).eq("kind", "visit").order("created_at", { ascending: false }).limit(150),
    sb.from("redemptions").select("id, created_at, kind, reward, staff_name, customer_id")
      .eq("business_id", id).order("created_at", { ascending: false }).limit(50),
    sb.from("customers").select("id, name").eq("business_id", id),
  ]);
  const names = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const rows = [
    ...((events ?? []) as Ev[]).map((e) => ({
      at: e.created_at, who: names.get(e.customer_id) ?? "—", staff: e.staff_name ?? "—",
      what: `Sello${e.amount > 1 ? ` ×${e.amount}` : ""}${e.is_double ? " (doble)" : ""}`, undone: e.undone_at,
    })),
    ...(reds ?? []).map((r) => ({
      at: r.created_at as string, who: names.get(r.customer_id) ?? "—", staff: (r.staff_name as string) ?? "—",
      what: `Canje: ${r.reward}`, undone: null as string | null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 150);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Historial de sellos y canjes</h1>
      <p className="text-sm text-stone-600">Cada movimiento queda registrado con empleado, fecha y hora (hora del centro de México).</p>
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr><th className="px-3 py-2">Fecha y hora</th><th className="px-3">Cliente</th><th className="px-3">Movimiento</th><th className="px-3">Empleado</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-stone-100 ${r.undone ? "text-stone-400 line-through" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2">{dateTime(r.at, business.timezone)}</td>
                <td className="px-3">{r.who}</td>
                <td className="px-3">{r.what}{r.undone && <span className="ml-1 no-underline">(deshecho)</span>}</td>
                <td className="px-3">{r.staff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
