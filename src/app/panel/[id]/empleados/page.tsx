import { requireBusiness } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { dateTime } from "@/lib/format";
import { StaffManager } from "./StaffManager";

export default async function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, business } = await requireBusiness(id);
  const { data } = await sb.from("staff").select("id, name, active, created_at, last_login_at").eq("business_id", id).order("created_at");
  const staff = (data ?? []).map((s) => ({ ...s, last_login: s.last_login_at ? dateTime(s.last_login_at, business.timezone) : null }));
  const staffUrl = `${publicEnv.appUrl}/n/${business.slug}/staff`;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Empleados</h1>
      <div className="card text-sm">
        <p className="font-semibold">Pantalla de sellado</p>
        <p className="mt-1 text-stone-600">
          Abre este enlace en el celular o tableta del mostrador y agrégalo a la pantalla de inicio. Cada empleado entra con su PIN y
          solo puede sellar y canjear.
        </p>
        <p className="mt-2 break-all rounded-lg bg-stone-100 p-2 font-mono text-xs">{staffUrl}</p>
      </div>
      <StaffManager businessId={id} staff={staff} />
    </div>
  );
}
