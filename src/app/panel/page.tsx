import Link from "next/link";
import { redirect } from "next/navigation";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { logoutAction } from "../entrar/actions";

export const metadata = { title: "Panel" };

export default async function PanelIndex() {
  const { sb, user } = await requireUser();
  const admin = await isPlatformAdmin(sb);
  const { data: owned } = await sb.from("business_owners").select("business_id, businesses(id, name, slug, status)").eq("user_id", user.id);
  const list = (owned ?? []).map((o) => (Array.isArray(o.businesses) ? o.businesses[0] : o.businesses)).filter(Boolean) as { id: string; name: string; slug: string }[];
  if (!admin && list.length === 1) redirect(`/panel/${list[0].id}`);
  if (admin && list.length === 0) redirect("/admin");
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">Tus negocios</h1>
      {list.length === 0 && <p className="mt-4 text-stone-600">Tu cuenta aún no tiene negocios asignados.</p>}
      <ul className="mt-4 space-y-2">
        {list.map((b) => (
          <li key={b.id}><Link href={`/panel/${b.id}`} className="card block font-semibold">{b.name}</Link></li>
        ))}
      </ul>
      {admin && <Link href="/admin" className="btn-secondary mt-6 w-full">Ir a superadmin</Link>}
      <form action={logoutAction}><button className="mt-4 text-sm underline">Cerrar sesión</button></form>
    </main>
  );
}
