"use client";

import { useState, useTransition } from "react";
import { staffLoginAction } from "./actions";

export function PinPad({ slug, accent, onAccent }: { slug: string; accent: string; onAccent: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (value: string) => {
    start(async () => {
      const r = await staffLoginAction(slug, value);
      if (r?.error) {
        setError(r.error);
        setPin("");
        if ("vibrate" in navigator) navigator.vibrate?.(200);
      }
    });
  };

  const press = (d: string) => {
    setError(null);
    if (pin.length < 6) setPin(pin + d);
  };

  return (
    <div className="mt-4 w-full max-w-xs">
      <div className="flex h-14 items-center justify-center gap-3" aria-live="polite" aria-label={`${pin.length} dígitos`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-white" : "border-2 border-stone-600"} ${i >= 4 ? "opacity-70" : ""}`} />
        ))}
      </div>
      <p className="h-6 text-center text-sm text-red-400" role="alert">{error}</p>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} disabled={pending}
            className="h-16 rounded-2xl bg-stone-800 text-2xl font-semibold active:bg-stone-700">{d}</button>
        ))}
        <button type="button" onClick={() => setPin(pin.slice(0, -1))} disabled={pending}
          className="h-16 rounded-2xl text-lg text-stone-300 active:bg-stone-800" aria-label="Borrar">⌫</button>
        <button type="button" onClick={() => press("0")} disabled={pending}
          className="h-16 rounded-2xl bg-stone-800 text-2xl font-semibold active:bg-stone-700">0</button>
        <button type="button" onClick={() => submit(pin)} disabled={pending || pin.length < 4}
          className="h-16 rounded-2xl text-lg font-bold disabled:opacity-40" style={{ background: accent, color: onAccent }}>
          {pending ? "…" : "Entrar"}
        </button>
      </div>
      {/* Campo oculto para teclados físicos y lectores de pantalla */}
      <form className="sr-only" onSubmit={(e) => { e.preventDefault(); submit(pin); }}>
        <label htmlFor="pin">PIN</label>
        <input id="pin" inputMode="numeric" autoComplete="off" value={pin} maxLength={6}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
      </form>
    </div>
  );
}
