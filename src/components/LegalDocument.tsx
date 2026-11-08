import { dateOnly } from "@/lib/format";
import type { LegalDoc } from "@/lib/legal";

/** Muestra un documento legal (formato simple: "## Título", "- viñeta", párrafos). */
export function LegalDocument({ doc, body }: { doc: LegalDoc; body: string }) {
  const blocks = body.trim().split(/\n\s*\n/);
  return (
    <article className="space-y-4 text-stone-800">
      {doc.is_draft && (
        <div role="note" className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-900" data-testid="draft-banner">
          BORRADOR · Pendiente de revisión legal. Este texto aún no ha sido validado por un abogado.
        </div>
      )}
      <header>
        <h1 className="text-2xl font-bold">{doc.title}</h1>
        <p className="text-sm text-stone-500">Versión {doc.version} · Publicado el {dateOnly(doc.created_at)}</p>
      </header>
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines[0]?.startsWith("## ")) {
          const rest = lines.slice(1);
          return (
            <section key={i}>
              <h2 className="mb-1 mt-2 text-lg font-semibold">{lines[0].slice(3)}</h2>
              {renderLines(rest)}
            </section>
          );
        }
        return <div key={i}>{renderLines(lines)}</div>;
      })}
    </article>
  );
}

function renderLines(lines: string[]) {
  if (lines.length === 0) return null;
  if (lines.every((l) => l.startsWith("- "))) {
    return <ul className="list-disc space-y-1 pl-5">{lines.map((l, i) => <li key={i}>{l.slice(2)}</li>)}</ul>;
  }
  return lines.map((l, i) => (l.startsWith("- ") ? <p key={i} className="pl-3">• {l.slice(2)}</p> : <p key={i}>{l}</p>));
}
