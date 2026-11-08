"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIpHash } from "@/lib/request";
import { callRpc } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

export async function loginAction(_prev: { error?: string; email?: string } | null, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Escribe tu correo y contraseña.", email };
  const allowed = await callRpc<boolean>("hit_rate_limit", { p_key: `login:${await clientIpHash()}`, p_max: 10, p_window_seconds: 900 });
  if (!allowed) return { error: "Demasiados intentos. Espera 15 minutos.", email };
  const sb = await createUserClient();
  const { error } = await sb.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Correo o contraseña incorrectos.", email };
  redirect("/panel");
}

export async function logoutAction() {
  const sb = await createUserClient();
  await sb.auth.signOut();
  redirect("/entrar");
}
