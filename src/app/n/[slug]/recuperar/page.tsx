import Link from "next/link";
import { notFound } from "next/navigation";
import { publicBusinessBySlug } from "@/lib/business";

export const metadata = { title: "Recuperar mi tarjeta" };

export default async function RecoverPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await publicBusinessBySlug(slug);
  if (!b) notFound();
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Link href={`/n/${slug}`} className="text-sm underline">← Volver a {b.name}</Link>
      <h1 className="mt-4 text-2xl font-bold">Recuperar mi tarjeta</h1>
      <p className="mt-2 text-stone-700">
        ¿Cambiaste de celular o borraste el enlace? Tus sellos no se pierden.
      </p>
      <ol className="card mt-5 list-decimal space-y-3 pl-8 text-stone-800">
        <li>Ve al mostrador de <strong>{b.name}</strong>.</li>
        <li>Dile al personal el número de WhatsApp con el que te registraste.</li>
        <li>Te mostrarán un código QR en su pantalla. Escanéalo con la cámara de tu celular.</li>
        <li>Se abrirá tu tarjeta con todos tus sellos. El enlace anterior dejará de funcionar.</li>
      </ol>
      <p className="mt-4 text-sm text-stone-600">
        Por tu seguridad, la recuperación se hace en persona: así nadie más puede ver tu tarjeta usando tu número.
      </p>
    </main>
  );
}
