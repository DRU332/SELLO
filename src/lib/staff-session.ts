import "server-only";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";

const COOKIE = "sellos_staff";

export async function getStaffToken() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function setStaffToken(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

export async function clearStaffToken() {
  (await cookies()).delete(COOKIE);
}

export type StaffSession = { staff_id: string; staff_name: string; business_id: string };

export async function currentStaff(): Promise<StaffSession | null> {
  const token = await getStaffToken();
  if (!token) return null;
  const { data } = await adminClient().rpc("staff_session", { p_session: token });
  const row = Array.isArray(data) ? data[0] : null;
  return row ?? null;
}

// Cookie con la tarjeta del cliente en este navegador (para volver a ella fácilmente)
export function cardCookieName(slug: string) {
  return `sellos_card_${slug.replace(/[^a-z0-9-]/g, "")}`;
}
