import type { Metadata } from "next";
import Link from "next/link";
import { logoUrl } from "@/lib/brand";
import { qrSvg } from "@/lib/qr";
import { callRpc } from "@/lib/supabase/admin";
import type { CustomerCard } from "@/lib/types";
import { CardView } from "./CardView";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ bienvenida?: string }> };

async function loadCard(token: string) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  return callRpc<CustomerCard | null>("get_customer_card", { p_token: token });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const card = await loadCard(token);
  if (!card) return { title: "Tarjeta no encontrada", robots: { index: false } };
  const slug = card.business.slug;
  return {
    title: `Mi tarjeta · ${card.business.name}`,
    robots: { index: false, follow: false },
    manifest: `/t/${token}/manifest.webmanifest`,
    icons: { apple: `/api/icono/${slug}?s=180`, icon: `/api/icono/${slug}?s=192` },
    appleWebApp: { capable: true, title: card.business.name, statusBarStyle: "default" },
  };
}

export default async function CardPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { bienvenida } = await searchParams;
  const card = await loadCard(token);
  if (!card) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold">Esta tarjeta no está disponible</h1>
        <p className="mt-2 text-stone-600">
          El enlace no es válido, fue reemplazado al recuperar la tarjeta o la cuenta se dio de baja.
          Pide ayuda en el mostrador del negocio.
        </p>
        <Link href="/" className="btn-secondary mt-6">Ir al inicio</Link>
      </main>
    );
  }
  // El QR solo contiene un código opaco: no revela datos ni permite sellarse solo.
  const qr = await qrSvg(card.customer.qr_code);
  return (
    <CardView token={token} initial={card} qrSvg={qr} logo={logoUrl(card.business.logo_path)} welcome={bienvenida === "1"} />
  );
}
