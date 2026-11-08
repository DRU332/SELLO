import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Cliente con la llave service_role. SOLO en el servidor.
 * Se usa para operaciones públicas (registro, tarjeta del cliente, sellado),
 * que pasan por funciones de la base que validan el negocio internamente.
 */
export function adminClient() {
  if (!client) {
    client = createClient(publicEnv.supabaseUrl, serverEnv.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Llama una función de la base y devuelve su resultado JSON. */
export async function callRpc<T = Record<string, unknown>>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await adminClient().rpc(fn, args);
  if (error) {
    console.error(`[rpc ${fn}]`, error.message);
    throw new Error("Error de base de datos");
  }
  return data as T;
}
