import { requireBusiness } from "@/lib/auth";
import { businessUrl } from "@/lib/brand";
import { qrSvg } from "@/lib/qr";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness(id);
  const url = businessUrl(business.slug);
  const svg = await qrSvg(url);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Cartel para el mostrador</h1>
        <p className="text-stone-600">
          Descarga el PDF (tamaño carta), imprímelo y colócalo junto a la caja. Tus clientes escanean el código con la cámara y se registran en segundos.
        </p>
        <a href={`/api/panel/${id}/cartel.pdf`} className="btn-primary" download>Descargar PDF para imprimir</a>
        <div className="card text-sm">
          <p className="font-semibold">Enlace de tu tarjeta</p>
          <p className="mt-1 break-all font-mono text-xs">{url}</p>
          <p className="mt-2 text-stone-600">También puedes ponerlo en tu Instagram, Facebook o Google Maps.</p>
        </div>
      </div>
      <div className="card mx-auto w-full max-w-xs text-center">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-2 text-sm text-stone-500">Así se ve el código del cartel</p>
      </div>
    </div>
  );
}
