"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type RegisterState } from "./actions";

export function RegisterForm({ slug, accent, onAccent, giftStamps }: { slug: string; accent: string; onAccent: string; giftStamps: number }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerAction, null);
  const f = state?.fields;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <div>
        <label className="label" htmlFor="name">Tu nombre</label>
        <input id="name" name="name" className="field" autoComplete="given-name" required maxLength={60}
          defaultValue={f?.name} placeholder="Ej. Mariana" />
      </div>
      <div>
        <label className="label" htmlFor="phone">WhatsApp (10 dígitos)</label>
        <input id="phone" name="phone" className="field" type="tel" inputMode="numeric" autoComplete="tel-national"
          required defaultValue={f?.phone} placeholder="33 1234 5678" />
        <p className="mt-1 text-xs text-stone-500">Sirve para recuperar tu tarjeta. No lo compartimos.</p>
      </div>
      <div>
        <label className="label" htmlFor="birthday">Cumpleaños <span className="font-normal text-stone-500">(opcional)</span></label>
        <input id="birthday" name="birthday" className="field" type="date" defaultValue={f?.birthday}
          max={new Date().toISOString().slice(0, 10)} />
      </div>

      <div className="space-y-3 rounded-xl bg-stone-50 p-3">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="privacy" required className="mt-0.5 h-5 w-5 shrink-0 accent-stone-900" />
          <span>
            Acepto el <Link href={`/n/${slug}/privacidad`} className="font-semibold underline" target="_blank">aviso de privacidad</Link>{" "}
            y los <Link href={`/n/${slug}/terminos`} className="font-semibold underline" target="_blank">términos</Link>.{" "}
            <span className="text-stone-500">(obligatorio)</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="marketing" className="mt-0.5 h-5 w-5 shrink-0 accent-stone-900" />
          <span>Quiero recibir promociones por WhatsApp. <span className="text-stone-500">(opcional)</span></span>
        </label>
      </div>

      {state?.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p>{state.error}</p>
          {state.code === "exists" && (
            <p className="mt-1">
              Si es tu número, <Link href={`/n/${slug}/recuperar`} className="font-semibold underline">recupera tu tarjeta aquí</Link>.
            </p>
          )}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn w-full py-4 text-lg"
        style={{ background: accent, color: onAccent }}>
        {pending ? "Creando tu tarjeta…" : giftStamps > 0 ? `Obtener mi tarjeta y ${giftStamps} sellos de regalo` : "Obtener mi tarjeta"}
      </button>
    </form>
  );
}
