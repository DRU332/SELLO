import { requireBusiness } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireBusiness(id);
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Mi cuenta</h1>
      <div className="card text-sm"><p className="text-stone-500">Correo</p><p className="font-medium">{user.email}</p></div>
      <PasswordForm />
    </div>
  );
}
