import { requireBusiness } from "@/lib/auth";
import { logoUrl } from "@/lib/brand";
import { ConfigForm } from "./ConfigForm";

export default async function ConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business, program } = await requireBusiness(id);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Mi tarjeta</h1>
      <ConfigForm businessId={id} business={business} program={program} initialLogo={logoUrl(business.logo_path)} />
    </div>
  );
}
