"use client";

import { useActionState } from "react";
import { changePasswordAction } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Cambiar contraseña</h2>
      <div>
        <label className="label" htmlFor="password">Nueva contraseña (mínimo 10 caracteres)</label>
        <input id="password" name="password" type="password" minLength={10} autoComplete="new-password" className="field" required />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Repítela</label>
        <input id="confirm" name="confirm" type="password" minLength={10} autoComplete="new-password" className="field" required />
      </div>
      {state && <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
      <button className="btn-primary" disabled={pending}>Guardar</button>
    </form>
  );
}
