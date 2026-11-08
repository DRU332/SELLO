import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { publicBusinessBySlug } from "@/lib/business";
import { brandTheme } from "@/lib/colors";
import { currentStaff } from "@/lib/staff-session";
import { Scanner } from "./Scanner";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Sellar",
    manifest: `/n/${slug}/staff/manifest.webmanifest`,
    icons: { apple: `/api/icono/${slug}?s=180` },
    appleWebApp: { capable: true, title: "Sellar", statusBarStyle: "black" },
    robots: { index: false },
  };
}

export default async function StampPage({ params }: Props) {
  const { slug } = await params;
  const b = await publicBusinessBySlug(slug);
  if (!b) notFound();
  const staff = await currentStaff();
  if (!staff || staff.business_id !== b.id) redirect(`/n/${slug}/staff`);
  const t = brandTheme(b.primary_color, b.secondary_color);
  return (
    <Scanner
      slug={slug}
      businessName={b.name}
      staffName={staff.staff_name}
      primary={t.primary}
      onPrimary={t.onPrimary}
      suspended={b.status === "suspended"}
    />
  );
}
