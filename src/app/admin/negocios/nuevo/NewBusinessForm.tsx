"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { slugify } from "@/lib/brand";
import { createBusinessAction, type CreateResult } from "../../actions";

export function NewBusinessForm() {
  const [state, action, pending] = useActionState<CreateResult | null, FormData>(createBusinessAction, null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const trialDefault = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  if (state?.ok) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text = `¡Bienvenido a Sellos!\nPanel: ${origin}/entrar\nCorreo: ${state.email}\n${state.password ? `Contraseña: ${state.password}\n` : ""}Tu página: ${origin}/n/${state.slug}`;
    return (
      <div className="card space-y-3" data-testid="created">
        <p className="text-lg font-semibold text-emerald-700">✓ Negocio creado</p>
        <dl className="space-y-1 text-sm">
          <div><dt className="inline text-stone-500">Correo del dueño: </dt><dd className="inline font-mono">{state.email}</dd></div>
          {state.password ? (
            <div><dt className="inline text-stone-500">Contraseña: </dt><dd className="inline font-mono font-bold" data-testid="new-password">{state.password}</dd></div>
          ) : (
            <p className="text-stone-600">Ese correo ya tenía cuenta: usa su contraseña actual.</p>
          )}
          <div><dt className="inline text-stone-500">Página del negocio: </dt><dd className="inline font-mono">/n/{state.slug}</dd></div>
        </dl>
        <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
          Copia la contraseña ahora: no se vuelve a mostrar. Envíasela al dueño por un medio privado.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => navigator.clipboard.writeText(text)}>Copiar datos de acceso</button>
          <Link href={`/panel/${state.businessId}/configuracion`} className="btn-primary">Configurar su tarjeta</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="name">Nombre del negocio</label>
        <input id="name" name="name" className="field" required maxLength={80} value={name}
          onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
      </div>
      <div>
        <label className="label" htmlFor="slug">Dirección web</label>
        <div className="flex items-center rounded-xl border border-stone-300 bg-white pl-3 focus-within:ring-2 focus-within:ring-stone-900/15">
          <span className="text-sm text-stone-500">/n/</span>
          <input id="slug" name="slug" className="w-full rounded-xl px-1 py-3 outline-none" required value={slug}
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="owner_email">Correo del dueño</label>
        <input id="owner_email" name="owner_email" type="email" className="field" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="status">Estado</label>
          <select id="status" name="status" className="field" defaultValue="trial">
            <option value="trial">Prueba</option>
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="trial_ends_at">Fin de prueba</label>
          <input id="trial_ends_at" name="trial_ends_at" type="date" className="field" defaultValue={trialDefault} />
        </div>
      </div>
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Creando…" : "Crear negocio"}</button>
    </form>
  );
}
