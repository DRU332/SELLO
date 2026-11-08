import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../entrar/actions";

export const metadata = { title: "Superadmin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="bg-stone-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-black">Sellos · Superadmin</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="hover:underline">Negocios</Link>
            <Link href="/admin/legal" className="hover:underline">Legal</Link>
            <form action={logoutAction}><button className="text-stone-300 hover:underline">Salir</button></form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
