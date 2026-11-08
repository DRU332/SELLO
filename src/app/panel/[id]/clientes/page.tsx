import { requireBusiness } from "@/lib/auth";
import { CustomersTable, type CustomerRow } from "./CustomersTable";

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  const { q } = await searchParams;
  const { sb, business, program } = await requireBusiness(id);
  let query = sb.from("customer_summary")
    .select("id, name, phone, birthday, marketing_opt_in, created_at, last_visit_at, visits, current_stamps, rewards_redeemed")
    .eq("business_id", id).is("deleted_at", null)
    .order("last_visit_at", { ascending: false, nullsFirst: false }).limit(300);
  const term = (q ?? "").trim().slice(0, 40);
  if (term) {
    const digits = term.replace(/\D/g, "");
    query = digits.length >= 4 ? query.like("phone", `%${digits}%`) : query.ilike("name", `%${term.replace(/[%_]/g, "")}%`);
  }
  const { data, count } = await query;
  const { count: total } = await sb.from("customers").select("id", { count: "exact", head: true }).eq("business_id", id).is("deleted_at", null);
  void count;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clientes <span className="text-stone-400">({total ?? 0})</span></h1>
        <a href={`/api/panel/${id}/clientes.csv`} className="btn-secondary" download>Exportar CSV</a>
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={term} placeholder="Buscar por nombre o teléfono" className="field" />
        <button className="btn-primary shrink-0">Buscar</button>
      </form>
      <CustomersTable
        rows={(data ?? []) as CustomerRow[]}
        businessName={business.name}
        stampsRequired={program.stamps_required}
        reward={program.reward_final}
        timezone={business.timezone}
      />
    </div>
  );
}
