import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { logoUrl } from "@/lib/brand";
import { publicBusinessBySlug } from "@/lib/business";
import { brandTheme } from "@/lib/colors";
import { currentStaff } from "@/lib/staff-session";
import { PinPad } from "./PinPad";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await publicBusinessBySlug(slug);
  return {
    title: b ? `Sellar · ${b.name}` : "Sellar",
    manifest: `/n/${slug}/staff/manifest.webmanifest`,
    icons: { apple: `/api/icono/${slug}?s=180` },
    appleWebApp: { capable: true, title: "Sellar" },
    robots: { index: false },
  };
}

export default async function StaffLoginPage({ params }: Props) {
  const { slug } = await params;
  const b = await publicBusinessBySlug(slug);
  if (!b) notFound();
  const staff = await currentStaff();
  if (staff && staff.business_id === b.id) redirect(`/n/${slug}/sellar`);
  const t = brandTheme(b.primary_color, b.secondary_color);
  const logo = logoUrl(b.logo_path);
  return (
    <main className="flex min-h-dvh flex-col items-center bg-stone-950 px-4 pb-8 pt-10 text-white">
      <div className="flex items-center gap-3">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1" />
        )}
        <div>
          <p className="text-xs uppercase tracking-wider text-stone-400">Pantalla de sellado</p>
          <h1 className="text-xl font-bold">{b.name}</h1>
        </div>
      </div>
      <p className="mt-8 text-stone-300">Escribe tu PIN de empleado</p>
      <PinPad slug={slug} accent={t.primary} onAccent={t.onPrimary} />
    </main>
  );
}
