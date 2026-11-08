"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness, UUID_RE } from "@/lib/auth";
import { errorMessage } from "@/lib/messages";

export async function saveStaffAction(businessId: string, input: { staffId: string | null; name: string; pin: string | null; active: boolean }) {
  const { sb } = await requireBusiness(businessId);
  if (input.staffId && !UUID_RE.test(input.staffId)) return { ok: false as const, error: "Empleado inválido." };
  const name = String(input.name ?? "").trim();
  const pin = input.pin ? String(input.pin) : null;
  if (pin !== null && !/^\d{4,6}$/.test(pin)) return { ok: false as const, error: errorMessage("invalid_pin") };
  const { data, error } = await sb.rpc("owner_save_staff", {
    p_business_id: businessId, p_staff_id: input.staffId, p_name: name, p_pin: pin, p_active: Boolean(input.active),
  });
  if (error) return { ok: false as const, error: "No se pudo guardar." };
  if (!data?.ok) return { ok: false as const, error: errorMessage(data?.error) };
  revalidatePath(`/panel/${businessId}/empleados`);
  return {
    ok: true as const,
    message: input.staffId
      ? pin ? `PIN de ${name} actualizado. Se cerraron sus sesiones abiertas.` : input.active ? `${name} está activo.` : `${name} fue desactivado y ya no puede sellar.`
      : `${name} agregado. PIN: ${pin}`,
  };
}
