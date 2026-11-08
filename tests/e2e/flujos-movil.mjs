/**
 * Prueba de punta a punta en tamaño móvil (iPhone 13 y Pixel 7).
 *   1) npm run demo        (crea los negocios demo y credenciales-demo.txt)
 *   2) npm run dev         (en otra terminal)
 *   3) npm run e2e
 * Si hay ffmpeg instalado, el escaneo usa una cámara simulada con el QR real del cliente.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import jsQR from "jsqr";
import { chromium, devices } from "playwright";
import QRCode from "qrcode";
import sharp from "sharp";

const BASE = process.env.E2E_URL || "http://localhost:3000";
const OUT = path.resolve("test-results");
mkdirSync(OUT, { recursive: true });
const creds = readFileSync("credenciales-demo.txt", "utf8");
const grab = (re) => creds.match(re)?.[1]?.trim();
const cafe = {
  slug: "demo-cafe-colibri",
  email: grab(/== Café Colibrí ==[\s\S]*?Correo:\s+(\S+)/),
  password: grab(/== Café Colibrí ==[\s\S]*?Contraseña:\s+(\S+)/),
  pin: grab(/PIN de Paty\s+(\d+)/),
};

let failures = 0;
const results = [];
function check(name, ok, detail = "") {
  results.push(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}
const visibleAlert = (page) => page.locator("[role=alert]:not(#__next-route-announcer__)").first();

const browser = await chromium.launch();
try {
  // ---------------- Cliente (iPhone) ----------------
  const client = await (await browser.newContext({ ...devices["iPhone 13"], locale: "es-MX", timezoneId: "America/Mexico_City" })).newPage();
  await client.goto(`${BASE}/n/${cafe.slug}`);
  check("Página del negocio muestra condiciones", await client.getByTestId("conditions").isVisible());
  const phone = `33${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
  await client.fill("#name", "Cliente E2E");
  await client.fill("#phone", phone);
  await client.click("button[type=submit]");
  await visibleAlert(client).waitFor();
  check("Sin aceptar el aviso de privacidad no se registra", (await visibleAlert(client).innerText()).includes("aviso de privacidad"));
  check("Casilla de promociones desmarcada por defecto", !(await client.isChecked("input[name=marketing]")));
  await client.check("input[name=privacy]");
  await client.click("button[type=submit]");
  await client.waitForURL(/\/t\//);
  const cardUrl = client.url().split("?")[0];
  const status0 = await client.getByTestId("card-status").innerText();
  check("Tarjeta con 2 sellos de regalo", status0.includes("faltan 6"), status0);
  await client.screenshot({ path: `${OUT}/iphone-tarjeta.png`, fullPage: true });

  // Registro duplicado con el mismo número
  const dup = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await dup.goto(`${BASE}/n/${cafe.slug}`);
  await dup.fill("#name", "Otra persona");
  await dup.fill("#phone", phone);
  await dup.check("input[name=privacy]");
  await dup.click("button[type=submit]");
  await visibleAlert(dup).waitFor();
  const dupText = await visibleAlert(dup).innerText();
  check("Teléfono duplicado no crea otra tarjeta ni muestra datos ajenos", dupText.includes("ya tiene una tarjeta") && !dupText.includes("Cliente E2E"));

  // QR del cliente: solo contiene un código opaco
  await client.getByTestId("show-qr").click();
  const qrShot = await client.getByTestId("qr").screenshot();
  const { data, info } = await sharp(qrShot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const qrText = jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? "";
  check("El QR no revela datos personales", /^S1[0-9a-f]{36}$/.test(qrText), qrText.slice(0, 8) + "…");
  await client.screenshot({ path: `${OUT}/iphone-qr.png` });

  // ---------------- Empleado (Android) ----------------
  let hasFfmpeg = true;
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { hasFfmpeg = false; }
  const launchArgs = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];
  if (hasFfmpeg && qrText) {
    const png = `${OUT}/qr-cliente.png`;
    await QRCode.toFile(png, qrText, { width: 420, margin: 4 });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-loop", "1", "-i", png, "-vf", "pad=640:480:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p", "-t", "3", "-r", "15", `${OUT}/qr.y4m`]);
    launchArgs.push(`--use-file-for-fake-video-capture=${OUT}/qr.y4m`);
  }
  const staffBrowser = await chromium.launch({ args: launchArgs });
  const staff = await (await staffBrowser.newContext({ ...devices["Pixel 7"], permissions: ["camera"], locale: "es-MX" })).newPage();
  await staff.goto(`${BASE}/n/${cafe.slug}/staff`);
  for (const d of cafe.pin) await staff.getByRole("button", { name: d, exact: true }).click();
  await staff.getByRole("button", { name: "Entrar" }).click();
  await staff.waitForURL(/sellar/);
  check("Empleado entra con PIN", true);

  const sheet = staff.getByTestId("confirm-sheet");
  if (hasFfmpeg) {
    await sheet.waitFor({ timeout: 20_000 });
    check("Cámara lee el QR del cliente", true);
  } else {
    await staff.getByRole("tab", { name: "Buscar teléfono" }).click();
    await staff.fill("#digits", phone.slice(-4));
    await staff.getByRole("button", { name: "Buscar", exact: true }).click();
    await staff.getByTestId("search-results").getByRole("button", { name: /Cliente E2E/ }).click();
    await sheet.waitFor();
  }
  const lookupMs = Number(await sheet.getAttribute("data-lookup-ms"));
  const t1 = Date.now();
  await staff.getByTestId("stamp-button").click();
  await staff.getByTestId("success").waitFor();
  const stampMs = Date.now() - t1;
  check("Escanear → confirmar → sellado en menos de 2 s", lookupMs + stampMs < 2000, `búsqueda ${lookupMs} ms + sellado ${stampMs} ms`);
  await staff.screenshot({ path: `${OUT}/android-sellado.png` });

  // La tarjeta del cliente se actualiza sola con animación (y cierra el QR)
  await client.getByText("¡Recibiste un sello!").waitFor({ timeout: 10_000 });
  const animated = await client.locator(".stamp-pop").count();
  check("El cliente ve el sello nuevo con animación", animated >= 1, `${animated} sello animado`);
  check("Tarjeta muestra 3 de 8", (await client.getByTestId("card-status").innerText()).includes("faltan 5"));

  // Segundo sello inmediato: bloqueado (la cámara vuelve a leer el mismo QR)
  await staff.getByTestId("undo-bar").waitFor();
  if (hasFfmpeg) {
    await staff.getByTestId("blocked-reason").waitFor({ timeout: 10_000 });
    check("Segundo sello bloqueado al volver a escanear", (await staff.getByTestId("blocked-reason").innerText()).includes("30 min"));
    await staff.getByRole("button", { name: "Cancelar" }).click();
  }
  await staff.getByRole("tab", { name: "Buscar teléfono" }).click();
  await staff.fill("#digits", phone);
  await staff.getByRole("button", { name: "Buscar", exact: true }).click();
  await staff.getByTestId("search-results").getByRole("button").first().click();
  await staff.getByTestId("blocked-reason").waitFor();
  check("Segundo sello bloqueado (búsqueda por teléfono)", (await staff.getByTestId("blocked-reason").innerText()).includes("30 min"));
  await staff.screenshot({ path: `${OUT}/android-bloqueo.png` });
  await staff.getByRole("button", { name: "Cancelar" }).click();

  // Deshacer
  await staff.getByRole("button", { name: /Deshacer/ }).click();
  await staff.getByText(/deshecho/).waitFor();
  await client.waitForFunction(() => document.querySelector("[data-testid=card-status]")?.textContent?.includes("faltan 6"), null, { timeout: 10_000 });
  check("Deshacer quita el sello también en la tarjeta del cliente", true);
  await staffBrowser.close();

  // ---------------- Privacidad del cliente ----------------
  await client.getByTestId("marketing-toggle").check();
  await client.getByText("Recibirás promociones por WhatsApp.").waitFor();
  check("Cliente activa promociones desde su tarjeta", true);
  await client.getByRole("button", { name: "Dar de baja mi cuenta" }).click();
  await client.getByRole("button", { name: "Sí, dar de baja" }).click();
  await client.waitForURL(/baja=1/);
  check("Baja de cuenta redirige con confirmación", (await client.locator("main").innerText()).includes("dada de baja"));
  await client.goto(cardUrl);
  check("El enlace anterior deja de funcionar tras la baja", (await client.locator("h1").innerText()).includes("no está disponible"));

  // ---------------- Dueño (iPhone) ----------------
  const owner = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await owner.goto(`${BASE}/entrar`);
  await owner.fill("#email", cafe.email);
  await owner.fill("#password", cafe.password);
  await owner.click("button:has-text('Entrar')");
  await owner.waitForURL(/\/panel\/[0-9a-f-]{36}$/);
  const report = await owner.getByTestId("monthly-report").innerText();
  check("Reporte mensual con texto y ventas estimadas", /regresaron \d+ clientes con tu tarjeta\. Calculamos \$[\d,]+ en ventas estimadas/.test(report));
  check("Botón para compartir por WhatsApp", (await owner.getByRole("link", { name: "Compartir por WhatsApp" }).getAttribute("href")).startsWith("https://wa.me/?text="));
  await owner.screenshot({ path: `${OUT}/iphone-panel.png`, fullPage: true });
  const panelId = owner.url().split("/").pop();
  const csv = await owner.request.get(`${BASE}/api/panel/${panelId}/clientes.csv`);
  check("Exportar clientes a CSV", csv.status() === 200 && (await csv.text()).includes("Acepta promociones"));
  const pdf = await owner.request.get(`${BASE}/api/panel/${panelId}/cartel.pdf`);
  check("Cartel PDF para imprimir", pdf.status() === 200 && pdf.headers()["content-type"] === "application/pdf");
  writeFileSync(`${OUT}/cartel.pdf`, await pdf.body());

  const foreign = await owner.goto(`${BASE}/panel/00000000-0000-4000-8000-000000000000`);
  check("Panel de un negocio ajeno o inexistente responde 404", foreign.status() === 404);
} catch (e) {
  check("Ejecución sin errores", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}

console.log("\n" + results.join("\n"));
console.log(`\n${results.length - failures}/${results.length} verificaciones correctas. Capturas en test-results/`);
process.exit(failures ? 1 : 0);
