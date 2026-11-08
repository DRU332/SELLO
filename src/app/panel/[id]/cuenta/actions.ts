"use server";

import { requireUser } from "@/lib/auth";

export async function changePasswordAction(_prev: unknown, formData: FormData) {
  const { sb } = await requireUser();
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) return { ok: false, message: "La contraseña debe tener al menos 10 caracteres." };
  if (password !== formData.get("confirm")) return { ok: false, message: "Las contraseñas no coinciden." };
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { ok: false, message: "No se pudo cambiar la contraseña. Prueba con otra más segura." };
  return { ok: true, message: "Contraseña actualizada." };
}
