import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client, Pool } from "pg";

// Base de datos de pruebas desechable (Postgres local). Nunca apuntes esto a producción.
const ADMIN_URL = process.env.TEST_PG_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres";
const DB_NAME = process.env.TEST_PG_DB ?? "sellos_test";
const root = path.resolve(__dirname, "../..");

export let pool: Pool;

export async function resetDatabase() {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${DB_NAME} with (force)`);
  await admin.query(`create database ${DB_NAME}`);
  await admin.query(readFileSync(path.join(root, "scripts/local/roles.sql"), "utf8"));
  await admin.end();

  const url = ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`);
  const db = new Client({ connectionString: url });
  await db.connect();
  await db.query(readFileSync(path.join(root, "scripts/local/auth-shim.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.query(readFileSync(path.join(dir, f), "utf8"));
  }
  await db.end();
  pool = new Pool({ connectionString: url, max: 6 });
}

export async function closeDatabase() {
  await pool?.end();
}

type Role = { kind: "service" } | { kind: "anon" } | { kind: "user"; id: string };

/** Ejecuta SQL simulando el rol con el que llegaría la petición a Supabase. */
export async function as<T = Record<string, unknown>>(role: Role, sql: string, params: unknown[] = []): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (role.kind === "service") await client.query("set local role service_role");
    if (role.kind === "anon") await client.query("set local role anon");
    if (role.kind === "user") {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: role.id, role: "authenticated" }),
      ]);
      await client.query("set local role authenticated");
    }
    const res = await client.query(sql, params);
    await client.query("commit");
    return res.rows as T[];
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export const service = { kind: "service" } as const;
export const anon = { kind: "anon" } as const;
export const user = (id: string) => ({ kind: "user", id }) as const;

/** SQL como superusuario (para preparar escenarios, p. ej. mover la hora de un sello). */
export async function raw<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await pool.query(sql, params)).rows as T[];
}

let phoneSeq = 1000;
export function nextPhone() {
  phoneSeq += 1;
  return `+52331000${String(phoneSeq).padStart(4, "0")}`;
}

export async function createBusiness(slug: string, name = `Negocio ${slug}`) {
  const [b] = await raw<{ id: string }>(
    "insert into public.businesses (slug, name, status) values ($1, $2, 'active') returning id",
    [slug, name],
  );
  return b.id;
}

export async function createOwner(businessId: string, email: string) {
  const [u] = await raw<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]);
  await raw("insert into public.business_owners (business_id, user_id) values ($1, $2)", [businessId, u.id]);
  return u.id;
}

export async function createAdmin(email: string) {
  const [u] = await raw<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]);
  await raw("insert into public.platform_admins (user_id) values ($1)", [u.id]);
  return u.id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resultados JSON libres en pruebas
export async function rpc<T = any>(role: Role, fn: string, args: unknown[]): Promise<T> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await as<{ r: T }>(role, `select public.${fn}(${placeholders}) as r`, args);
  return rows[0].r;
}

export async function createStaff(ownerId: string, businessId: string, name: string, pin: string) {
  const r = await rpc(user(ownerId), "owner_save_staff", [businessId, null, name, pin, true]);
  if (!r.ok) throw new Error(`staff: ${r.error}`);
  return r.staff_id as string;
}

export async function staffLogin(slug: string, pin: string, ip = "ip-test") {
  return rpc(service, "staff_login", [slug, pin, ip]);
}

export async function registerCustomer(slug: string, opts: Partial<{
  name: string; phone: string; privacy: boolean; marketing: boolean; ip: string;
}> = {}) {
  return rpc(service, "register_customer", [
    slug,
    opts.name ?? "Cliente Prueba",
    opts.phone ?? nextPhone(),
    null,
    opts.privacy ?? true,
    "2026-11-08.1",
    "2026-11-08.1",
    opts.marketing ?? false,
    opts.ip ?? `ip-${Math.random()}`,
    "vitest",
  ]);
}

export async function customerIdFromToken(token: string) {
  const [c] = await raw<{ id: string }>(
    "select id from public.customers where access_token_hash = public.hash_token($1)",
    [token],
  );
  return c?.id;
}

/** Simula que el último sello visita del cliente ocurrió hace N minutos. */
export async function ageVisits(customerId: string, minutes: number) {
  await raw(
    "update public.stamp_events set created_at = created_at - make_interval(mins => $2) where customer_id = $1",
    [customerId, minutes],
  );
}
