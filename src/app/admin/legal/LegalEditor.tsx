"use client";

import { useActionState } from "react";
import type { LegalDoc } from "@/lib/legal";
import { publishLegalAction } from "../actions";

export function LegalEditor({ doc }: { doc: LegalDoc }) {
  const [state, action, pending] = useActionState(publishLegalAction, null);
  return (
    <form action={action} className="card space-y-3">
      <input type="hidden" name="kind" value={doc.kind} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{doc.kind === "privacy" ? "Aviso de privacidad" : "Términos y condiciones"}</h2>
        <span className="text-xs text-stone-500">Versión actual: {doc.version}{doc.is_draft ? " · BORRADOR" : ""}</span>
      </div>
      <input name="title" className="field" defaultValue={doc.title} aria-label="Título" />
      <textarea name="body" className="field h-80 font-mono text-sm" defaultValue={doc.body.trim()} aria-label="Texto" />
      <p className="text-xs text-stone-500">Formato: «## Título de sección», «- viñeta» y párrafos separados por una línea en blanco.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_draft" defaultChecked={doc.is_draft} className="h-5 w-5 accent-stone-900" />
        Marcar como borrador pendiente de revisión legal
      </label>
      {state && <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
      <button className="btn-primary" disabled={pending}>Publicar nueva versión</button>
    </form>
  );
}
