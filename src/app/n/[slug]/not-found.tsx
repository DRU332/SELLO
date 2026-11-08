import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">No encontramos este negocio</h1>
      <p className="mt-2 text-stone-600">Revisa que el enlace o el código QR sean correctos.</p>
      <Link href="/" className="btn-secondary mt-6">Ir al inicio</Link>
    </main>
  );
}
