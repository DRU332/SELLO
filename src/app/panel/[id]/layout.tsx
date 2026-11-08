import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { logoutAction } from "../../entrar/actions";
import { PanelNav } from "./PanelNav";

const STATUS = { trial: "Prueba", active: "Activo", suspended: "Suspendido" } as const;

export default async function PanelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business, isAdmin } = await requireBusiness(id);
  return (
    <div className="min-h-dvh">
      {isAdmin && (
        <div className="bg-indigo-700 px-4 py-2 text-center text-sm text-white">
          Estás viendo este negocio como superadmin · <Link href="/admin" className="font-semibold underline">Volver a superadmin</Link>
        </div>
      )}
      {business.status === "suspended" && (
        <div className="bg-red-700 px-4 py-2 text-center text-sm text-white">
          Cuenta suspendida: tus clientes conservan sus datos, pero no se pueden agregar sellos.
        </div>
      )}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{business.name}</p>
            <p className="text-xs text-stone-500">
              Plan: {STATUS[business.status]}
              {business.status === "trial" && business.trial_ends_at ? ` (hasta ${business.trial_ends_at})` : ""} ·{" "}
              <Link href={`/n/${business.slug}`} className="underline" target="_blank">Ver página pública</Link>
            </p>
          </div>
          <form action={logoutAction}><button className="text-sm text-stone-600 underline">Salir</button></form>
        </div>
        <PanelNav id={id} />
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-5">{children}</main>
    </div>
  );
}
