"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PanelNav({ id }: { id: string }) {
  const path = usePathname();
  const items = [
    ["", "Resumen"],
    ["/clientes", "Clientes"],
    ["/configuracion", "Mi tarjeta"],
    ["/empleados", "Empleados"],
    ["/imprimir", "Cartel QR"],
    ["/historial", "Historial"],
    ["/cuenta", "Mi cuenta"],
  ];
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2" aria-label="Secciones del panel">
      {items.map(([href, label]) => {
        const full = `/panel/${id}${href}`;
        const active = href === "" ? path === full : path.startsWith(full);
        return (
          <Link key={href} href={full} aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
