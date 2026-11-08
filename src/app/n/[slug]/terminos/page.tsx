import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/LegalDocument";
import { publicBusinessBySlug } from "@/lib/business";
import { currentLegal, renderLegalBody } from "@/lib/legal";

export const metadata = { title: "Términos y condiciones" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await publicBusinessBySlug(slug);
  if (!b) notFound();
  const doc = await currentLegal("terms");
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/n/${slug}`} className="text-sm underline">← Volver a {b.name}</Link>
      <div className="mt-4"><LegalDocument doc={doc} body={renderLegalBody(doc.body, b.name)} /></div>
    </main>
  );
}
