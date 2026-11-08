"use client";

import { useState, useTransition } from "react";
import { saveStaffAction } from "./actions";

type Staff = { id: string; name: string; active: boolean; last_login: string | null };

function randomPin() {
  const a = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(a);
    const p = String(a[0] % 1_000_000).padStart(6, "0");
    if (!/^(\d)\1+$/.test(p) && p !== "123456" && p !== "654321") return p;
  }
}

export function StaffManager({ businessId, staff }: { businessId: string; staff: Staff[] }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [pending, start] = useTransition();

  const save = (input: { staffId: string | null; name: string; pin: string | null; active: boolean }, after?: () => void) =>
    start(async () => {
      const r = await saveStaffAction(businessId, input);
      setMsg({ text: r.ok ? r.message : r.error, ok: r.ok });
      if (r.ok) after?.();
    });

  return (
    <div className="space-y-5">
      <form className="card space-y-3" onSubmit={(e) => {
        e.preventDefault();
        save({ staffId: null, name, pin, active: true }, () => { setName(""); setPin(""); });
      }}>
        <h2 className="font-semibold">Agregar empleado</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
          <div>
            <label className="label" htmlFor="staff-name">Nombre</label>
            <input id="staff-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          </div>
          <div>
            <label className="label" htmlFor="staff-pin">PIN (4 a 6 números)</label>
            <div className="flex gap-2">
              <input id="staff-pin" className="field font-mono" inputMode="numeric" value={pin} maxLength={6} required
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              <button type="button" className="btn-secondary shrink-0 px-3 text-sm" onClick={() => setPin(randomPin())}>Generar</button>
            </div>
          </div>
          <button className="btn-primary self-end" disabled={pending}>Agregar</button>
        </div>
        <p className="text-xs text-stone-500">Anota el PIN y dáselo en persona. Por seguridad no podrás volver a verlo; solo cambiarlo.</p>
      </form>

      {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}

      <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
        {staff.length === 0 && <li className="p-4 text-sm text-stone-500">Aún no hay empleados.</li>}
        {staff.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className={`font-medium ${s.active ? "" : "text-stone-400 line-through"}`}>{s.name}</p>
              <p className="text-xs text-stone-500">{s.active ? "Activo" : "Desactivado"} · Último acceso: {s.last_login ?? "nunca"}</p>
            </div>
            {editing === s.id ? (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); save({ staffId: s.id, name: s.name, pin: newPin, active: s.active }, () => { setEditing(null); setNewPin(""); }); }}>
                <input className="field w-28 py-2 font-mono" inputMode="numeric" placeholder="Nuevo PIN" aria-label="Nuevo PIN" value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                <button type="button" className="btn-secondary px-2 py-2 text-xs" onClick={() => setNewPin(randomPin())}>Generar</button>
                <button className="btn-primary px-3 py-2 text-sm" disabled={pending}>Guardar</button>
              </form>
            ) : (
              <div className="flex gap-2">
                <button className="btn-secondary px-3 py-2 text-sm" onClick={() => { setEditing(s.id); setNewPin(""); }}>Cambiar PIN</button>
                <button className="btn-secondary px-3 py-2 text-sm" disabled={pending}
                  onClick={() => save({ staffId: s.id, name: s.name, pin: null, active: !s.active })}>
                  {s.active ? "Desactivar" : "Activar"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
