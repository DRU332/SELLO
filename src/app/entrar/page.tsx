import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const { user } = await currentUser();
  if (user) redirect("/panel");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 text-2xl font-black tracking-tight">Sellos</Link>
      <h1 className="text-2xl font-bold">Entrar a tu panel</h1>
      <p className="mt-1 text-sm text-stone-600">Para dueños de negocio y administración.</p>
      <LoginForm />
      <p className="mt-6 text-sm text-stone-600">
        ¿Olvidaste tu contraseña? Pide a tu contacto de Sellos que la restablezca.
      </p>
      <p className="mt-2 text-sm text-stone-600">
        ¿Eres empleado? Entra desde la pantalla de sellado de tu negocio con tu PIN.
      </p>
    </main>
  );
}
