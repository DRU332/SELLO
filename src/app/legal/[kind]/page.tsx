import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/LegalDocument";
import { currentLegal, renderLegalBody } from "@/lib/legal";

const KINDS = { privacidad: "privacy", terminos: "terms" } as const;

export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const k = KINDS[kind as keyof typeof KINDS];
  if (!k) notFound();
  const doc = await currentLegal(k);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="text-sm underline">← Inicio</Link>
      <div className="mt-4"><LegalDocument doc={doc} body={renderLegalBody(doc.body, "el negocio que te dio la tarjeta")} /></div>
    </main>
  );
}
