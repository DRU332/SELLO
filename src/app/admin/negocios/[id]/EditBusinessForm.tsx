"use client";

import { useActionState, useState, useTransition } from "react";
import { resetOwnerPasswordAction, updateBusinessAction } from "../../actions";

export function EditBusinessForm({ id, name, slug, status, trialEndsAt }: { id: string; name: string; slug: string; status: string; trialEndsAt: string | null }) {
  const [state, action, pending] = useActionState(updateBusinessAction.bind(null, id), null);
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="name">Nombre</label>
        <input id="name" name="name" className="field" defaultValue={name} required />
      </div>
      <div>
        <label className="label" htmlFor="slug">Dirección (/n/…)</label>
        <input id="slug" name="slug" className="field" defaultValue={slug} required />
        <p className="mt-1 text-xs text-amber-700">Si la cambias, los carteles QR impresos dejarán de funcionar.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="status">Estado</label>
          <select id="status" name="status" className="field" defaultValue={status}>
            <option value="trial">Prueba</option>
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="trial_ends_at">Fin de prueba</label>
          <input id="trial_ends_at" name="trial_ends_at" type="date" className="field" defaultValue={trialEndsAt ?? ""} />
        </div>
      </div>
      <p className="text-xs text-stone-500">Suspendido: los clientes conservan sus datos y sellos, pero no se pueden agregar sellos ni registrar clientes nuevos.</p>
      {state && <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
      <button className="btn-primary" disabled={pending}>Guardar</button>
    </form>
  );
}

export function OwnerReset({ businessId, ownerId, email }: { businessId: string; ownerId: string; email: string }) {
  const [password, setPassword] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="font-mono">{email}</span>
      {password ? (
        <span>Nueva contraseña: <strong className="font-mono">{password}</strong></span>
      ) : (
        <button className="btn-secondary px-3 py-2 text-sm" disabled={pending}
          onClick={() => start(async () => { const r = await resetOwnerPasswordAction(businessId, ownerId); if (r.ok) setPassword(r.password); })}>
          Restablecer contraseña
        </button>
      )}
    </div>
  );
}
