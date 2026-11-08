// Variables de entorno. Los secretos NUNCA van en el código: se configuran en
// .env.local (desarrollo) o en Vercel → Settings → Environment Variables.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa el README (sección "Variables de entorno").`);
  }
  return value;
}

export const publicEnv = {
  // Se escriben literalmente para que Next.js pueda incluirlas en el navegador.
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get appUrl() {
    return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  },
};

export const serverEnv = {
  get serviceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get ipHashSalt() {
    return required("IP_HASH_SALT", process.env.IP_HASH_SALT);
  },
};

export const APP_TIMEZONE = "America/Mexico_City";
export const LOGO_MAX_BYTES = 1024 * 1024; // 1 MB
