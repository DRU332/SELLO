import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, UUID_RE } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { EditBusinessForm, OwnerReset } from "./EditBusinessForm";

export default async function EditBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { sb } = await requireAdmin();
  const { data: b } = await sb.from("businesses").select("*").eq("id", id).maybeSingle();
  if (!b) notFound();
  const { data: owners } = await sb.from("business_owners").select("user_id").eq("business_id", id);
  const emails = await Promise.all((owners ?? []).map(async (o) => {
    const { data } = await adminClient().auth.admin.getUserById(o.user_id);
    return { id: o.user_id, email: data.user?.email ?? "—" };
  }));
  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{b.name}</h1>
        <Link href={`/panel/${id}`} className="btn-secondary">Ver su panel</Link>
      </div>
      <EditBusinessForm id={id} name={b.name} slug={b.slug} status={b.status} trialEndsAt={b.trial_ends_at} />
      <section className="card space-y-3">
        <h2 className="font-semibold">Dueños</h2>
        {emails.map((o) => <OwnerReset key={o.id} businessId={id} ownerId={o.id} email={o.email} />)}
      </section>
      <section className="card text-sm text-stone-600">
        <h2 className="font-semibold text-stone-900">Cobros</h2>
        <p className="mt-1">
          Aún sin integración de pagos. Proveedor: {b.billing_provider ?? "—"} · Cliente: {b.billing_customer_id ?? "—"} · Suscripción: {b.billing_subscription_id ?? "—"}.
          Cambia el estado manualmente arriba (prueba, activo o suspendido).
        </p>
      </section>
    </div>
  );
}
