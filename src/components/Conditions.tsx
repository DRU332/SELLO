import { describeConditions } from "@/lib/program";
import type { Program } from "@/lib/types";

export function Conditions({ program, timezone, className = "" }: { program: Program; timezone?: string; className?: string }) {
  return (
    <section className={`rounded-2xl border border-stone-200 bg-white/80 p-4 text-sm text-stone-700 ${className}`}
      aria-labelledby="condiciones" data-testid="conditions">
      <h3 id="condiciones" className="mb-2 font-semibold text-stone-900">Condiciones de la promoción</h3>
      <ul className="list-disc space-y-1 pl-5">
        {describeConditions(program, timezone).map((l) => <li key={l}>{l}</li>)}
      </ul>
    </section>
  );
}
