import { claimRecoveryAction } from "./actions";

export const metadata = { title: "Recuperar tarjeta", robots: { index: false } };

// Se pide un toque para confirmar: así las vistas previas de enlaces no consumen el código.
export default async function ClaimPage({ params, searchParams }: {
  params: Promise<{ code: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { code } = await params;
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">Recuperar mi tarjeta</h1>
      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800" role="alert">
          Este código ya se usó o venció (dura 10 minutos). Pide uno nuevo en el mostrador.
        </p>
      ) : (
        <>
          <p className="mt-2 text-stone-600">Toca el botón para abrir tu tarjeta en este celular.</p>
          <form action={claimRecoveryAction} className="mt-6">
            <input type="hidden" name="code" value={code} />
            <button className="btn-primary w-full py-4 text-lg">Abrir mi tarjeta</button>
          </form>
        </>
      )}
    </main>
  );
}
