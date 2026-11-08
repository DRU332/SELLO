import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { dateOnly, num } from "@/lib/format";

type Row = { id: string; slug: string; name: string; status: "trial" | "active" | "suspended"; created_at: string; trial_ends_at: string | null; customers: number; visits_30d: number; owner_emails: string | null };

const BADGE = {
  active: "bg-emerald-100 text-emerald-800",
  trial: "bg-sky-100 text-sky-800",
  suspended: "bg-red-100 text-red-800",
} as const;
const LABEL = { active: "Activo", trial: "Prueba", suspended: "Suspendido" } as const;

export default async function AdminHome() {
  const { sb } = await requireAdmin();
  const { data } = await sb.rpc("admin_overview");
  const rows = (data ?? []) as Row[];
  const count = (s: Row["status"]) => rows.filter((r) => r.status === s).length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Negocios</h1>
        <Link href="/admin/negocios/nuevo" className="btn-primary">+ Nuevo negocio</Link>
      </div>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Activos" value={count("active")} />
        <Stat label="En prueba" value={count("trial")} />
        <Stat label="Suspendidos" value={count("suspended")} />
        <Stat label="Clientes en total" value={rows.reduce((a, r) => a + Number(r.customers), 0)} />
      </section>
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr><th className="px-3 py-2">Negocio</th><th className="px-3">Estado</th><th className="px-3 text-right">Clientes</th><th className="px-3 text-right">Visitas 30 d</th><th className="px-3">Dueño</th><th className="px-3">Alta</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-stone-100">
                <td className="px-3 py-2"><p className="font-medium">{r.name}</p><p className="text-xs text-stone-500">/n/{r.slug}</p></td>
                <td className="px-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.status]}`}>{LABEL[r.status]}</span>
                  {r.status === "trial" && r.trial_ends_at && <p className="text-xs text-stone-500">hasta {r.trial_ends_at}</p>}
                </td>
                <td className="px-3 text-right tabular-nums">{num(r.customers)}</td>
                <td className="px-3 text-right tabular-nums">{num(r.visits_30d)}</td>
                <td className="px-3 text-xs">{r.owner_emails ?? "—"}</td>
                <td className="whitespace-nowrap px-3 text-xs">{dateOnly(r.created_at)}</td>
                <td className="whitespace-nowrap px-3 text-right">
                  <Link href={`/admin/negocios/${r.id}`} className="mr-3 underline">Editar</Link>
                  <Link href={`/panel/${r.id}`} className="underline">Ver panel</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums" data-testid={`stat-${label}`}>{num(value)}</p>
    </div>
  );
}
