/**
 * Crea (o recrea) dos negocios de demostración con clientes, visitas y canjes.
 *   npm run demo
 * Imprime las credenciales generadas al azar y las guarda en credenciales-demo.txt
 * (ese archivo NO se sube a git). Vuelve a ejecutarlo para cambiar todas las claves.
 */
import { createHash, randomBytes, randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { loadEnv } from "./env";

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const token = (bytes = 32) => randomBytes(bytes).toString("base64url");
const sha256Hex = (s: string) => "\\x" + createHash("sha256").update(s, "utf8").digest("hex");
const password = () => token(15); // 20 caracteres aleatorios
function pin() {
  for (;;) {
    const p = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (!/^(\d)\1+$/.test(p) && !["123456", "654321"].includes(p)) return p;
  }
}
const pick = <T,>(a: T[]) => a[randomInt(0, a.length)];

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data as NonNullable<T>;
}

const LOGO_CAFE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="96" fill="#5b3a29"/>
  <circle cx="100" cy="100" r="84" fill="none" stroke="#e8c39e" stroke-width="4"/>
  <path d="M58 92h70v22a30 30 0 0 1-30 30H88a30 30 0 0 1-30-30z" fill="#e8c39e"/>
  <path d="M128 98h8a14 14 0 0 1 0 28h-8" fill="none" stroke="#e8c39e" stroke-width="8"/>
  <path d="M78 62c-6 8 6 12 0 20M96 58c-6 8 6 12 0 20M114 62c-6 8 6 12 0 20" fill="none" stroke="#e8c39e" stroke-width="5" stroke-linecap="round"/>
  <path d="M142 50c10-10 26-8 30 0-12 2-20 6-30 0z" fill="#2f9e8f"/>
</svg>`;

const LOGO_FONDA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="6" y="6" width="188" height="188" rx="40" fill="#b42318"/>
  <path d="M40 120a60 60 0 0 1 120 0z" fill="#fbbf24"/>
  <path d="M40 120h120" stroke="#fff7ed" stroke-width="8" stroke-linecap="round"/>
  <path d="M60 104l10-12M86 96l10-12M112 96l10-12M136 104l8-10" stroke="#15803d" stroke-width="7" stroke-linecap="round"/>
  <circle cx="100" cy="150" r="10" fill="#fff7ed"/>
  <circle cx="70" cy="150" r="6" fill="#fff7ed"/>
  <circle cx="130" cy="150" r="6" fill="#fff7ed"/>
</svg>`;

const FIRST = ["María", "José", "Guadalupe", "Juan", "Fernanda", "Luis", "Ximena", "Carlos", "Valeria", "Jorge", "Daniela",
  "Miguel", "Sofía", "Alejandro", "Regina", "Ricardo", "Camila", "Eduardo", "Andrea", "Óscar", "Paola", "Héctor", "Lucía",
  "Arturo", "Mariana", "Rubén", "Itzel", "Raúl", "Natalia", "Emilio", "Renata", "Iván", "Karla", "Tomás", "Brenda"];
const LAST = ["G.", "H.", "R.", "M.", "L.", "P.", "S.", "C.", "V.", "T."];

type Demo = {
  slug: string; name: string; logo: string; primary: string; secondary: string; icon: string; ticket: number;
  program: Record<string, unknown>; customers: number; staff: string[]; ownerEmail: string;
};

const DEMOS: Demo[] = [
  {
    slug: "demo-cafe-colibri", name: "Café Colibrí", logo: LOGO_CAFE, primary: "#5b3a29", secondary: "#f6ead9", icon: "cafe",
    ticket: 75, customers: 46, staff: ["Paty", "Leo"], ownerEmail: "dueno.cafe@demo.sellos.mx",
    program: {
      stamps_required: 8, signup_gift: 2, reward_final: "Un café o latte gratis", reward_mid: "Un pan dulce", reward_mid_at: 5,
      cooldown_minutes: 30, restrictions: "Bebida de tamaño mediano. No aplica con otras promociones.",
      double_rules: [{ days: [2], from: "16:00", to: "19:00" }],
    },
  },
  {
    slug: "demo-fonda-dona-lupe", name: "Fonda Doña Lupe", logo: LOGO_FONDA, primary: "#b42318", secondary: "#fff4e5", icon: "cubiertos",
    ticket: 120, customers: 34, staff: ["Rosa", "Memo"], ownerEmail: "duena.fonda@demo.sellos.mx",
    program: {
      stamps_required: 10, signup_gift: 2, reward_final: "Una comida corrida gratis", reward_mid: null, reward_mid_at: null,
      cooldown_minutes: 120, restrictions: "Válido de lunes a sábado. No aplica en días festivos.",
      valid_until: `${new Date().getFullYear() + 1}-12-31`, double_rules: [],
    },
  },
];

async function removeExisting(d: Demo) {
  const { data: existing } = await sb.from("businesses").select("id").eq("slug", d.slug).maybeSingle();
  if (existing) {
    const owners = await must(sb.from("business_owners").select("user_id").eq("business_id", existing.id), "dueños");
    await must(sb.from("businesses").delete().eq("id", existing.id), "borrar negocio");
    for (const o of owners ?? []) await sb.auth.admin.deleteUser(o.user_id);
  }
  // Por si quedó un usuario huérfano con el mismo correo
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const orphan = data?.users.find((u) => u.email === d.ownerEmail);
  if (orphan) await sb.auth.admin.deleteUser(orphan.id);
}

async function createDemo(d: Demo) {
  await removeExisting(d);
  const business = await must(
    sb.from("businesses").insert({
      slug: d.slug, name: d.name, status: "active", primary_color: d.primary, secondary_color: d.secondary,
      stamp_icon: d.icon, avg_ticket_mxn: d.ticket,
    }).select("id").single(),
    "crear negocio",
  );
  const bid = business.id as string;
  await must(sb.from("programs").update(d.program).eq("business_id", bid), "programa");

  // Logo (SVG → PNG, igual que al subirlo desde el panel)
  const png = await sharp(Buffer.from(d.logo), { density: 300 }).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const path = `${bid}/logo-${Date.now()}.png`;
  const up = await sb.storage.from("logos").upload(path, png, { contentType: "image/png", upsert: true });
  if (up.error) throw new Error(`logo: ${up.error.message}`);
  await must(sb.from("businesses").update({ logo_path: path }).eq("id", bid), "logo_path");

  // Dueño con contraseña aleatoria
  const ownerPassword = password();
  const created = await sb.auth.admin.createUser({ email: d.ownerEmail, password: ownerPassword, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`dueño: ${created.error?.message}`);
  await must(sb.from("business_owners").insert({ business_id: bid, user_id: created.data.user.id }), "vincular dueño");

  // Empleados con PIN aleatorio (se guardan con hash bcrypt en la base)
  const staffRows: { id: string; name: string; pin: string }[] = [];
  for (const name of d.staff) {
    const p = pin();
    const hash = await must(sb.rpc("hash_pin", { p_pin: p }), "hash pin");
    const row = await must(sb.from("staff").insert({ business_id: bid, name, pin_hash: hash }).select("id").single(), "empleado");
    staffRows.push({ id: row.id, name, pin: p });
  }

  // Clientes e historial de los últimos ~4 meses
  const program = d.program as { stamps_required: number; signup_gift: number; reward_final: string; reward_mid: string | null; reward_mid_at: number | null; cooldown_minutes: number };
  const now = Date.now();
  const DAY = 86_400_000;
  const usedPhones = new Set<string>();
  let sampleToken = "";
  for (let i = 0; i < d.customers; i++) {
    let phone = "";
    do phone = `+5233${String(randomInt(10_000_000, 99_999_999))}`; while (usedPhones.has(phone));
    usedPhones.add(phone);
    const t = token();
    if (i === 0) sampleToken = t;
    const profile = i % 7 === 0 ? "en_riesgo" : i % 3 === 0 ? "frecuente" : i % 4 === 0 ? "una_vez" : "normal";
    const registeredAt = now - randomInt(profile === "en_riesgo" ? 80 : 5, 125) * DAY - randomInt(0, 8) * 3_600_000;
    const marketing = randomInt(0, 10) < 6;
    const birthday = randomInt(0, 10) < 5 ? `${randomInt(1965, 2006)}-${String(randomInt(1, 13)).padStart(2, "0")}-${String(randomInt(1, 29)).padStart(2, "0")}` : null;
    const customer = await must(sb.from("customers").insert({
      business_id: bid, name: `${pick(FIRST)} ${pick(LAST)}`, phone, birthday, marketing_opt_in: marketing,
      access_token_hash: sha256Hex(t), qr_code: "S1" + randomBytes(18).toString("hex"),
      created_at: new Date(registeredAt).toISOString(),
    }).select("id").single(), "cliente");
    const cid = customer.id as string;
    const at = (ms: number) => new Date(ms).toISOString();

    await must(sb.from("consents").insert([
      { business_id: bid, customer_id: cid, kind: "privacy", granted: true, document_version: "2026-11-08.1", created_at: at(registeredAt) },
      { business_id: bid, customer_id: cid, kind: "terms", granted: true, document_version: "2026-11-08.1", created_at: at(registeredAt) },
      { business_id: bid, customer_id: cid, kind: "marketing", granted: marketing, document_version: "2026-11-08.1", created_at: at(registeredAt) },
    ]), "consentimientos");

    let cycle = 1;
    let card = await must(sb.from("cards").insert({ business_id: bid, customer_id: cid, cycle, created_at: at(registeredAt) }).select("id").single(), "tarjeta");
    let stamps = program.signup_gift;
    await must(sb.from("stamp_events").insert({ business_id: bid, customer_id: cid, card_id: card.id, kind: "signup_gift", amount: program.signup_gift, created_at: at(registeredAt) }), "regalo");

    // Visitas: la primera el día del registro; luego según el perfil
    const gap = profile === "frecuente" ? [2, 6] : profile === "normal" ? [5, 16] : [8, 20];
    const stopAt = profile === "en_riesgo" ? now - randomInt(35, 55) * DAY : now - randomInt(0, 3) * DAY;
    let tVisit = registeredAt + 5 * 60_000;
    const events: Record<string, unknown>[] = [];
    let lastVisit = 0;
    for (let v = 0; tVisit < stopAt; v++) {
      if (profile === "una_vez" && v > 0) break;
      const s = pick(staffRows);
      events.push({ business_id: bid, customer_id: cid, card_id: card.id, kind: "visit", amount: 1, staff_id: s.id, staff_name: s.name, created_at: at(tVisit) });
      lastVisit = tVisit;
      stamps += 1;
      if (program.reward_mid_at && stamps === program.reward_mid_at && randomInt(0, 10) < 7) {
        await must(sb.from("cards").update({ mid_redeemed_at: at(tVisit + 60_000) }).eq("id", card.id), "mid");
        await must(sb.from("redemptions").insert({ business_id: bid, customer_id: cid, card_id: card.id, kind: "mid", reward: program.reward_mid, staff_id: s.id, staff_name: s.name, created_at: at(tVisit + 60_000) }), "canje mid");
      }
      if (stamps >= program.stamps_required) {
        if (events.length) await must(sb.from("stamp_events").insert(events.splice(0)), "visitas");
        const redeemAt = tVisit + randomInt(1, 4) * DAY;
        if (redeemAt < now) {
          await must(sb.from("cards").update({ status: "redeemed", redeemed_at: at(redeemAt) }).eq("id", card.id), "cerrar tarjeta");
          await must(sb.from("redemptions").insert({ business_id: bid, customer_id: cid, card_id: card.id, kind: "final", reward: program.reward_final, staff_id: s.id, staff_name: s.name, created_at: at(redeemAt) }), "canje");
          cycle += 1;
          card = await must(sb.from("cards").insert({ business_id: bid, customer_id: cid, cycle, created_at: at(redeemAt) }).select("id").single(), "nueva tarjeta");
          stamps = 0;
          tVisit = redeemAt;
        } else break;
      }
      tVisit += randomInt(gap[0], gap[1]) * DAY + randomInt(-3, 4) * 3_600_000;
    }
    if (events.length) await must(sb.from("stamp_events").insert(events), "visitas");
    if (lastVisit) await must(sb.from("customers").update({ last_visit_at: at(lastVisit) }).eq("id", cid), "última visita");
  }
  return { bid, ownerPassword, staffRows, sampleToken };
}

async function main() {
  const lines: string[] = [
    "CREDENCIALES DE DEMO · Sellos",
    `Generadas: ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`,
    "NO compartas este archivo. Vuelve a ejecutar `npm run demo` para generar claves nuevas.",
    "",
  ];
  for (const d of DEMOS) {
    process.stdout.write(`Creando ${d.name}… `);
    const r = await createDemo(d);
    console.log("listo");
    lines.push(
      `== ${d.name} ==`,
      `Página para clientes:   ${appUrl}/n/${d.slug}`,
      `Panel del dueño:        ${appUrl}/entrar`,
      `  Correo:               ${d.ownerEmail}`,
      `  Contraseña:           ${r.ownerPassword}`,
      `Pantalla de sellado:    ${appUrl}/n/${d.slug}/staff`,
      ...r.staffRows.map((s) => `  PIN de ${s.name.padEnd(12)} ${s.pin}`),
      `Tarjeta de ejemplo:     ${appUrl}/t/${r.sampleToken}`,
      "",
    );
  }
  const text = lines.join("\n");
  writeFileSync("credenciales-demo.txt", text + "\n", { mode: 0o600 });
  console.log("\n" + text);
  console.log("(También se guardaron en credenciales-demo.txt)");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
