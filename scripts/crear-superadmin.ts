/**
 * Crea tu usuario de superadministrador (o le genera una contraseña nueva).
 *   npm run crear-superadmin -- tu@correo.com
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env";

loadEnv();
const email = (process.argv[2] || "").trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Uso: npm run crear-superadmin -- tu@correo.com");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const password = randomBytes(15).toString("base64url");
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users.find((u) => u.email === email);
  if (user) {
    const { error } = await sb.auth.admin.updateUserById(user.id, { password });
    if (error) throw error;
  } else {
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("No se pudo crear el usuario");
    user = data.user;
  }
  const { error } = await sb.from("platform_admins").upsert({ user_id: user.id });
  if (error) throw error;
  console.log("\nSuperadmin listo ✅");
  console.log(`  Correo:     ${email}`);
  console.log(`  Contraseña: ${password}`);
  console.log("Guárdala en un lugar seguro. Puedes cambiarla después desde el panel (Mi cuenta).\n");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
