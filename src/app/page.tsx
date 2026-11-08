import Link from "next/link";
import { LoyaltyCard } from "@/components/LoyaltyCard";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <p className="text-xl font-black tracking-tight">Sellos</p>
        <Link href="/entrar" className="btn-secondary px-4 py-2 text-sm">Entrar</Link>
      </header>

      <section className="mt-10 grid items-center gap-10 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">
            Tu tarjeta de sellos, ahora en el celular de tus clientes.
          </h1>
          <p className="mt-4 text-lg text-stone-600">
            Para cafés, fondas y negocios de barrio. Tus clientes escanean un QR en el mostrador y listo:
            sin descargar apps, sin contraseñas y con la marca de tu negocio.
          </p>
          <ul className="mt-6 space-y-2 text-stone-700">
            <li>✓ Sellado en segundos con la cámara del celular</li>
            <li>✓ Antifraude: nadie se puede sellar solo</li>
            <li>✓ Reporte mensual de clientes que regresaron y ventas estimadas</li>
            <li>✓ Funciona en iPhone y Android</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/n/demo-cafe-colibri" className="btn-primary">Ver demo: cafetería</Link>
            <Link href="/n/demo-fonda-dona-lupe" className="btn-secondary">Ver demo: fonda</Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <LoyaltyCard businessName="Tu negocio" logoUrl={null} primaryColor="#0f766e" secondaryColor="#ecfdf5"
            stampIcon="cafe" stampsRequired={8} stamps={5} giftStamps={2} rewardFinal="Un café gratis" customerName="Mariana" />
        </div>
      </section>
      <footer className="mt-16 flex flex-wrap gap-4 text-sm text-stone-500">
        <Link href="/legal/privacidad" className="underline">Aviso de privacidad</Link>
        <Link href="/legal/terminos" className="underline">Términos</Link>
        <span>Guadalajara, Jalisco · Precios en MXN</span>
      </footer>
    </main>
  );
}
