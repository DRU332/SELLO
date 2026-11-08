import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env";

/** IP del visitante convertida en hash (no guardamos IPs en claro). */
export async function clientIpHash() {
  const h = await headers();
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  return createHash("sha256").update(`${serverEnv.ipHashSalt}:${ip}`).digest("hex").slice(0, 32);
}

export async function userAgent() {
  return ((await headers()).get("user-agent") || "").slice(0, 300);
}

/** Protección CSRF para rutas API que modifican datos: el Origin debe ser el mismo sitio. */
export async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
