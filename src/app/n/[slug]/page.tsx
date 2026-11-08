import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Conditions } from "@/components/Conditions";
import { LoyaltyCard } from "@/components/LoyaltyCard";
import { logoUrl } from "@/lib/brand";
import { publicBusinessBySlug } from "@/lib/business";
import { brandTheme } from "@/lib/colors";
import { cardCookieName } from "@/lib/staff-session";
import { callRpc } from "@/lib/supabase/admin";
import { RegisterForm } from "./RegisterForm";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ baja?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await publicBusinessBySlug(slug);
  if (!b) return { title: "Negocio no encontrado" };
  return {
    title: `Tarjeta de lealtad de ${b.name}`,
    manifest: `/n/${slug}/manifest.webmanifest`,
    icons: { apple: `/api/icono/${slug}?s=180`, icon: `/api/icono/${slug}?s=192` },
    appleWebApp: { capable: true, title: b.name },
  };
}

export default async function BusinessPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { baja } = await searchParams;
  const b = await publicBusinessBySlug(slug);
  if (!b) notFound();
  const t = brandTheme(b.primary_color, b.secondary_color);

  // ¿Este navegador ya tiene tarjeta aquí?
  const saved = (await cookies()).get(cardCookieName(slug))?.value;
  const hasCard = saved ? Boolean(await callRpc("get_customer_card", { p_token: saved })) : false;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-10 pt-6" style={{ background: `linear-gradient(180deg, ${t.background} 0%, #f8f7f4 55%)` }}>
      {baja && (
        <div role="status" className="mb-4 rounded-xl border border-stone-200 bg-white p-3 text-sm">
          Tu cuenta fue dada de baja y tus datos personales se eliminaron.
        </div>
      )}

      <LoyaltyCard
        businessName={b.name}
        logoUrl={logoUrl(b.logo_path)}
        primaryColor={b.primary_color}
        secondaryColor={b.secondary_color}
        stampIcon={b.stamp_icon}
        stampsRequired={b.program.stamps_required}
        stamps={b.program.signup_gift}
        giftStamps={b.program.signup_gift}
        rewardFinal={b.program.reward_final}
        rewardMid={b.program.reward_mid}
        rewardMidAt={b.program.reward_mid_at}
      />

      {hasCard && saved ? (
        <div className="mt-6 space-y-3">
          <Link href={`/t/${saved}`} className="btn w-full py-4 text-lg" style={{ background: t.primary, color: t.onPrimary }}>
            Ver mi tarjeta
          </Link>
        </div>
      ) : b.status === "suspended" ? (
        <div className="card mt-6 text-center text-sm">
          La tarjeta de {b.name} está en pausa por el momento. Si ya tienes tarjeta, tus sellos están a salvo.
        </div>
      ) : (
        <section className="card mt-6">
          <h1 className="text-xl font-bold">Crea tu tarjeta gratis</h1>
          <p className="mb-4 mt-1 text-sm text-stone-600">
            Sin descargar nada y sin contraseñas. Junta {b.program.stamps_required} sellos y gana{" "}
            <strong>{b.program.reward_final}</strong>.
          </p>
          <RegisterForm slug={slug} accent={t.primary} onAccent={t.onPrimary} giftStamps={b.program.signup_gift} />
        </section>
      )}

      <Conditions program={b.program} timezone={b.timezone} className="mt-6" />

      <p className="mt-6 text-center text-sm">
        <Link href={`/n/${slug}/recuperar`} className="font-medium underline">¿Ya tenías tarjeta? Recupérala</Link>
      </p>
      <footer className="mt-8 flex justify-center gap-4 text-xs text-stone-500">
        <Link href={`/n/${slug}/privacidad`} className="underline">Aviso de privacidad</Link>
        <Link href={`/n/${slug}/terminos`} className="underline">Términos</Link>
        <span>Hecho con Sellos</span>
      </footer>
    </main>
  );
}
