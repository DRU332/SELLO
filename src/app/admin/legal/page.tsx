import { requireAdmin } from "@/lib/auth";
import { currentLegal } from "@/lib/legal";
import { LegalEditor } from "./LegalEditor";

export default async function LegalAdmin() {
  await requireAdmin();
  const [privacy, terms] = await Promise.all([currentLegal("privacy"), currentLegal("terms")]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Aviso de privacidad y términos</h1>
      <p className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
        Los textos incluidos son un <strong>borrador</strong>. Pide a un abogado que los revise antes de usarlos con clientes reales.
        Al guardar se crea una versión nueva; cada cliente queda ligado a la versión que aceptó. Usa <code>{"{{negocio}}"}</code> para el nombre de cada negocio.
      </p>
      <LegalEditor doc={privacy} />
      <LegalEditor doc={terms} />
    </div>
  );
}
