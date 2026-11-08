import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ageVisits, anon, as, closeDatabase, createAdmin, createBusiness, createOwner, createStaff,
  customerIdFromToken, nextPhone, raw, registerCustomer, resetDatabase, rpc, service, staffLogin, user,
} from "./helpers";

let bizA: string, bizB: string, ownerA: string, ownerB: string, adminId: string;
let sessionA: string, sessionB: string;

beforeAll(async () => {
  await resetDatabase();
  bizA = await createBusiness("cafe-a", "Café A");
  bizB = await createBusiness("fonda-b", "Fonda B");
  ownerA = await createOwner(bizA, "a@ejemplo.mx");
  ownerB = await createOwner(bizB, "b@ejemplo.mx");
  adminId = await createAdmin("admin@ejemplo.mx");
  await createStaff(ownerA, bizA, "Ana", "4821");
  await createStaff(ownerB, bizB, "Beto", "7390");
  sessionA = (await staffLogin("cafe-a", "4821")).token;
  sessionB = (await staffLogin("fonda-b", "7390")).token;
}, 60_000);

afterAll(closeDatabase);

async function newCustomer(slug: string, extra = {}) {
  const r = await registerCustomer(slug, extra);
  expect(r.ok).toBe(true);
  return { token: r.token as string, id: (await customerIdFromToken(r.token))! };
}

describe("Separación entre negocios (RLS)", () => {
  it("un dueño solo ve clientes, negocios e historial de su negocio", async () => {
    const a = await newCustomer("cafe-a");
    const b = await newCustomer("fonda-b");
    await rpc(service, "stamp_customer", [sessionB, b.id]);

    const customers = await as<{ business_id: string }>(user(ownerA), "select business_id from public.customers");
    expect(customers.length).toBeGreaterThan(0);
    expect(customers.every((c) => c.business_id === bizA)).toBe(true);

    const businesses = await as<{ id: string }>(user(ownerA), "select id from public.businesses");
    expect(businesses.map((x) => x.id)).toEqual([bizA]);

    const events = await as(user(ownerA), "select * from public.stamp_events where business_id = $1", [bizB]);
    expect(events).toHaveLength(0);

    const summary = await as(user(ownerA), "select * from public.customer_summary where id = $1", [b.id]);
    expect(summary).toHaveLength(0);
    const consents = await as(user(ownerA), "select * from public.consents where customer_id = $1", [b.id]);
    expect(consents).toHaveLength(0);
    expect(a.id).toBeTruthy();
  });

  it("los reportes de otro negocio devuelven ceros", async () => {
    const r = await rpc(user(ownerA), "business_report", [bizB, "2020-01-01", "2100-01-01"]);
    expect(r.total_customers).toBe(0);
    expect(r.visits).toBe(0);
    const risk = await as(user(ownerA), "select * from public.at_risk_customers($1)", [bizB]);
    expect(risk).toHaveLength(0);
  });

  it("un dueño no puede modificar otro negocio, ni su estado, ni crear empleados ajenos", async () => {
    const updated = await as(user(ownerA), "update public.businesses set name = 'Hackeado' where id = $1 returning id", [bizB]);
    expect(updated).toHaveLength(0);
    await expect(as(user(ownerA), "update public.businesses set status = 'active' where id = $1", [bizA]))
      .rejects.toThrow(/permission denied/);
    const r = await rpc(user(ownerA), "owner_save_staff", [bizB, null, "Intruso", "5555", true]);
    expect(r).toMatchObject({ ok: false, error: "forbidden" });
    const st = await rpc(user(ownerA), "admin_set_business_status", [bizB, "suspended"]);
    expect(st).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("los secretos (PIN y tokens) no son legibles ni por el dueño", async () => {
    await expect(as(user(ownerA), "select pin_hash from public.staff")).rejects.toThrow(/permission denied/);
    await expect(as(user(ownerA), "select access_token_hash from public.customers")).rejects.toThrow(/permission denied/);
    await expect(as(user(ownerA), "select qr_code from public.customers")).rejects.toThrow(/permission denied/);
    await expect(as(user(ownerA), "select * from public.staff_sessions")).rejects.toThrow(/permission denied/);
  });

  it("anon no puede leer ninguna tabla de negocio ni llamar funciones internas", async () => {
    for (const t of ["businesses", "customers", "stamp_events", "staff", "consents", "redemptions"]) {
      await expect(as(anon, `select * from public.${t}`)).rejects.toThrow(/permission denied/);
    }
    await expect(as(anon, "select public.stamp_customer('x', gen_random_uuid())")).rejects.toThrow(/permission denied/);
    await expect(as(user(ownerA), "select public.stamp_customer('x', gen_random_uuid())")).rejects.toThrow(/permission denied/);
  });

  it("un empleado no puede consultar ni sellar clientes de otro negocio", async () => {
    const b = await newCustomer("fonda-b");
    const lookup = await rpc(service, "staff_lookup", [sessionA, null, b.id]);
    expect(lookup).toMatchObject({ ok: false, error: "not_found" });
    const [{ qr_code }] = await raw<{ qr_code: string }>("select qr_code from public.customers where id = $1", [b.id]);
    expect(await rpc(service, "staff_lookup", [sessionA, qr_code, null])).toMatchObject({ ok: false, error: "not_found" });
    expect(await rpc(service, "stamp_customer", [sessionA, b.id])).toMatchObject({ ok: false, error: "not_found" });
    expect(await rpc(service, "redeem_reward", [sessionA, b.id, "final"])).toMatchObject({ ok: false, error: "not_found" });
  });

  it("el superadmin ve todos los negocios", async () => {
    const rows = await as<{ id: string }>(user(adminId), "select id from public.businesses order by slug");
    expect(rows.map((r) => r.id).sort()).toEqual([bizA, bizB].sort());
  });

  it("sin sesión de empleado válida no se puede sellar (el QR del cliente no basta)", async () => {
    const a = await newCustomer("cafe-a");
    expect(await rpc(service, "stamp_customer", ["token-falso", a.id])).toMatchObject({ ok: false, error: "unauthorized" });
    expect(await rpc(service, "stamp_customer", [a.token, a.id])).toMatchObject({ ok: false, error: "unauthorized" });
  });
});

describe("Bloqueo de doble sello", () => {
  it("bloquea un segundo sello durante 30 minutos por defecto", async () => {
    const c = await newCustomer("cafe-a");
    const first = await rpc(service, "stamp_customer", [sessionA, c.id]);
    expect(first.ok).toBe(true);
    const second = await rpc(service, "stamp_customer", [sessionA, c.id]);
    expect(second).toMatchObject({ ok: false, error: "cooldown" });
    expect(second.wait_minutes).toBeGreaterThan(28);
    expect(second.wait_minutes).toBeLessThanOrEqual(30);

    await ageVisits(c.id, 31);
    expect((await rpc(service, "stamp_customer", [sessionA, c.id])).ok).toBe(true);
  });

  it("respeta el tiempo configurado por el negocio", async () => {
    await raw("update public.programs set cooldown_minutes = 5 where business_id = $1", [bizB]);
    const c = await newCustomer("fonda-b");
    await rpc(service, "stamp_customer", [sessionB, c.id]);
    await ageVisits(c.id, 4);
    expect(await rpc(service, "stamp_customer", [sessionB, c.id])).toMatchObject({ error: "cooldown", wait_minutes: 1 });
    await ageVisits(c.id, 2);
    expect((await rpc(service, "stamp_customer", [sessionB, c.id])).ok).toBe(true);
    await raw("update public.programs set cooldown_minutes = 30 where business_id = $1", [bizB]);
  });

  it("dos sellos simultáneos al mismo cliente: solo uno pasa", async () => {
    const c = await newCustomer("cafe-a");
    const results = await Promise.all([1, 2, 3].map(() => rpc(service, "stamp_customer", [sessionA, c.id])));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const [{ n }] = await raw<{ n: string }>(
      "select count(*) n from public.stamp_events where customer_id = $1 and kind = 'visit'", [c.id]);
    expect(Number(n)).toBe(1);
  });

  it("deshacer funciona solo durante 2 minutos y queda en el historial", async () => {
    const c = await newCustomer("cafe-a");
    const s1 = await rpc(service, "stamp_customer", [sessionA, c.id]);
    const undo = await rpc(service, "undo_stamp", [sessionA, s1.event_id]);
    expect(undo.ok).toBe(true);
    expect(undo.customer.state.stamps).toBe(2); // solo los de regalo
    // Tras deshacer se puede volver a sellar (el sello anulado no cuenta para el bloqueo)
    const s2 = await rpc(service, "stamp_customer", [sessionA, c.id]);
    expect(s2.ok).toBe(true);
    await raw("update public.stamp_events set created_at = now() - interval '3 minutes' where id = $1", [s2.event_id]);
    expect(await rpc(service, "undo_stamp", [sessionA, s2.event_id])).toMatchObject({ ok: false, error: "undo_expired" });
    const [ev] = await raw<{ undone_at: Date; staff_name: string }>(
      "select undone_at, staff_name from public.stamp_events where id = $1", [s1.event_id]);
    expect(ev.undone_at).toBeTruthy();
    expect(ev.staff_name).toBe("Ana");
  });

  it("doble sello según día y horario, sin pasar del total", async () => {
    await raw(`update public.programs set double_rules = '[{"days":[0,1,2,3,4,5,6],"from":"00:00","to":"24:00"}]'
               where business_id = $1`, [bizA]);
    try {
      const c = await newCustomer("cafe-a");
      const r = await rpc(service, "stamp_customer", [sessionA, c.id]);
      expect(r).toMatchObject({ ok: true, amount: 2 });
      expect(r.customer.state.stamps).toBe(4);
      // Llevar la tarjeta a 7 de 8: el doble solo suma 1
      await raw(`insert into public.stamp_events (business_id, customer_id, card_id, kind, amount, created_at)
                 select business_id, customer_id, card_id, 'visit', 3, now() - interval '2 days'
                 from public.stamp_events where id = $1`, [r.event_id]);
      await ageVisits(c.id, 60);
      const capped = await rpc(service, "stamp_customer", [sessionA, c.id]);
      expect(capped).toMatchObject({ ok: true, amount: 1 });
      expect(capped.customer.state.stamps).toBe(8);
    } finally {
      await raw("update public.programs set double_rules = '[]' where business_id = $1", [bizA]);
    }
  });

  it("un negocio suspendido conserva los datos pero no puede sellar ni registrar", async () => {
    const c = await newCustomer("fonda-b");
    expect((await rpc(user(adminId), "admin_set_business_status", [bizB, "suspended"])).ok).toBe(true);
    expect(await rpc(service, "stamp_customer", [sessionB, c.id])).toMatchObject({ ok: false, error: "suspended" });
    expect(await registerCustomer("fonda-b")).toMatchObject({ ok: false, error: "suspended" });
    const seen = await as(user(ownerB), "select id from public.customers where id = $1", [c.id]);
    expect(seen).toHaveLength(1);
    await rpc(user(adminId), "admin_set_business_status", [bizB, "active"]);
  });
});

describe("Canje y reinicio de tarjeta", () => {
  async function fillCard(customerId: string) {
    // 2 de regalo + 6 visitas separadas por más de 30 min
    for (let i = 0; i < 6; i++) {
      const r = await rpc(service, "stamp_customer", [sessionA, customerId]);
      expect(r.ok).toBe(true);
      await ageVisits(customerId, 40);
    }
  }

  it("no se puede canjear antes de completar y no se sella una tarjeta llena", async () => {
    const c = await newCustomer("cafe-a");
    expect(await rpc(service, "redeem_reward", [sessionA, c.id, "final"])).toMatchObject({ ok: false, error: "not_enough" });
    await fillCard(c.id);
    expect(await rpc(service, "stamp_customer", [sessionA, c.id])).toMatchObject({ ok: false, error: "card_full" });
  });

  it("al canjear se registra el canje y la tarjeta reinicia en cero (sin nuevo regalo)", async () => {
    const c = await newCustomer("cafe-a");
    await fillCard(c.id);
    const r = await rpc(service, "redeem_reward", [sessionA, c.id, "final"]);
    expect(r.ok).toBe(true);
    expect(r.customer.state).toMatchObject({ stamps: 0, gift_stamps: 0, cycle: 2, rewards_redeemed: 1 });
    const red = await raw<{ staff_name: string; kind: string }>(
      "select staff_name, kind from public.redemptions where customer_id = $1", [c.id]);
    expect(red).toEqual([{ staff_name: "Ana", kind: "final" }]);
    // Un segundo canje inmediato no es posible
    expect(await rpc(service, "redeem_reward", [sessionA, c.id, "final"])).toMatchObject({ ok: false, error: "not_enough" });
    // La nueva tarjeta acepta sellos
    expect((await rpc(service, "stamp_customer", [sessionA, c.id])).ok).toBe(true);
  });

  it("premio intermedio: se canjea una vez por tarjeta y no reinicia", async () => {
    await raw("update public.programs set reward_mid = 'Galleta', reward_mid_at = 4 where business_id = $1", [bizA]);
    const c = await newCustomer("cafe-a");
    expect(await rpc(service, "redeem_reward", [sessionA, c.id, "mid"])).toMatchObject({ error: "not_enough" });
    for (let i = 0; i < 2; i++) {
      await rpc(service, "stamp_customer", [sessionA, c.id]);
      await ageVisits(c.id, 40);
    }
    const mid = await rpc(service, "redeem_reward", [sessionA, c.id, "mid"]);
    expect(mid.ok).toBe(true);
    expect(mid.customer.state.stamps).toBe(4);
    expect(await rpc(service, "redeem_reward", [sessionA, c.id, "mid"])).toMatchObject({ error: "already_redeemed" });
    await raw("update public.programs set reward_mid = null, reward_mid_at = null where business_id = $1", [bizA]);
  });

  it("no se puede deshacer un sello si la tarjeta ya se canjeó", async () => {
    const c = await newCustomer("cafe-a");
    for (let i = 0; i < 5; i++) {
      await rpc(service, "stamp_customer", [sessionA, c.id]);
      await ageVisits(c.id, 40);
    }
    const last = await rpc(service, "stamp_customer", [sessionA, c.id]);
    await rpc(service, "redeem_reward", [sessionA, c.id, "final"]);
    expect(await rpc(service, "undo_stamp", [sessionA, last.event_id])).toMatchObject({ error: "card_redeemed" });
  });
});

describe("Reportes", () => {
  it("los sellos de regalo no cuentan como visitas; ventas estimadas = regresos × ticket", async () => {
    const biz = await createBusiness("reporte-c");
    const owner = await createOwner(biz, "c@ejemplo.mx");
    await raw("update public.businesses set avg_ticket_mxn = 85 where id = $1", [biz]);
    await createStaff(owner, biz, "Caro", "2468");
    const s = (await staffLogin("reporte-c", "2468")).token;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

    const c1 = await newCustomer("reporte-c");
    const c2 = await newCustomer("reporte-c");
    let r = await rpc(user(owner), "business_report", [biz, today, today]);
    expect(r).toMatchObject({ new_customers: 2, visits: 0, gift_stamps: 4, returning_customers: 0 });

    await rpc(service, "stamp_customer", [s, c1.id]); // 1.ª visita
    await ageVisits(c1.id, 40);
    await rpc(service, "stamp_customer", [s, c1.id]); // regreso
    await ageVisits(c1.id, 40);
    await rpc(service, "stamp_customer", [s, c1.id]); // regreso
    await rpc(service, "stamp_customer", [s, c2.id]); // 1.ª visita
    r = await rpc(user(owner), "business_report", [biz, today, today]);
    expect(r).toMatchObject({ visits: 4, returning_visits: 2, returning_customers: 1 });
    expect(Number(r.estimated_sales_mxn)).toBe(170);
  });

  it("clientes en riesgo: frecuentes sin visitar en N días", async () => {
    const biz = await createBusiness("riesgo-d");
    const owner = await createOwner(biz, "d@ejemplo.mx");
    await createStaff(owner, biz, "Dani", "1357");
    const s = (await staffLogin("riesgo-d", "1357")).token;
    const frecuente = await newCustomer("riesgo-d", { name: "Frecuente", marketing: true });
    const ocasional = await newCustomer("riesgo-d", { name: "Ocasional" });
    for (let i = 0; i < 3; i++) {
      await rpc(service, "stamp_customer", [s, frecuente.id]);
      await ageVisits(frecuente.id, 60 * 24 * 12);
    }
    await ageVisits(frecuente.id, 60 * 24 * 20); // última visita hace 32 días
    await rpc(service, "stamp_customer", [s, ocasional.id]);
    await ageVisits(ocasional.id, 60 * 24 * 40);
    const risk = await as<{ name: string }>(user(owner), "select name from public.at_risk_customers($1)", [biz]);
    expect(risk.map((x) => x.name)).toEqual(["Frecuente"]);
  });
});

describe("Registro y consentimiento", () => {
  it("sin aceptar el aviso de privacidad no se crea nada", async () => {
    const phone = nextPhone();
    const r = await registerCustomer("cafe-a", { privacy: false, phone });
    expect(r).toMatchObject({ ok: false, error: "consent_required" });
    const rows = await raw("select id from public.customers where phone = $1", [phone]);
    expect(rows).toHaveLength(0);
  });

  it("guarda fecha y versión de cada consentimiento; promociones desmarcadas por defecto", async () => {
    const c = await newCustomer("cafe-a");
    const rows = await raw<{ kind: string; granted: boolean; document_version: string; created_at: Date }>(
      "select kind, granted, document_version, created_at from public.consents where customer_id = $1 order by kind", [c.id]);
    expect(rows.map((r) => [r.kind, r.granted, r.document_version])).toEqual([
      ["privacy", true, "2026-11-08.1"],
      ["terms", true, "2026-11-08.1"],
      ["marketing", false, "2026-11-08.1"],
    ]);
    expect(rows.every((r) => r.created_at instanceof Date)).toBe(true);
  });

  it("cambiar la preferencia de promociones agrega un registro nuevo", async () => {
    const c = await newCustomer("cafe-a", { marketing: true });
    expect((await rpc(service, "customer_set_marketing", [c.token, false, "2026-11-08.1", "ip", "ua"])).ok).toBe(true);
    const rows = await raw<{ granted: boolean }>(
      "select granted from public.consents where customer_id = $1 and kind = 'marketing' order by created_at", [c.id]);
    expect(rows.map((r) => r.granted)).toEqual([true, false]);
    const [cust] = await raw<{ marketing_opt_in: boolean }>("select marketing_opt_in from public.customers where id = $1", [c.id]);
    expect(cust.marketing_opt_in).toBe(false);
  });

  it("evita duplicados por teléfono en el mismo negocio, pero no entre negocios", async () => {
    const phone = nextPhone();
    expect((await registerCustomer("cafe-a", { phone })).ok).toBe(true);
    expect(await registerCustomer("cafe-a", { phone })).toMatchObject({ ok: false, error: "exists" });
    expect((await registerCustomer("fonda-b", { phone })).ok).toBe(true);
  });

  it("la baja borra los datos personales y desactiva el enlace", async () => {
    const c = await newCustomer("cafe-a", { marketing: true });
    expect((await rpc(service, "customer_delete", [c.token, "2026-11-08.1", "ip", "ua"])).ok).toBe(true);
    const [row] = await raw<{ name: string; phone: string | null; marketing_opt_in: boolean; deleted_at: Date }>(
      "select name, phone, marketing_opt_in, deleted_at from public.customers where id = $1", [c.id]);
    expect(row).toMatchObject({ name: "Cliente dado de baja", phone: null, marketing_opt_in: false });
    expect(await rpc(service, "get_customer_card", [c.token])).toBeNull();
  });

  it("límite de intentos de registro por IP", async () => {
    const results = [];
    for (let i = 0; i < 12; i++) results.push(await registerCustomer("cafe-a", { ip: "ip-abuso" }));
    expect(results.filter((r) => r.ok)).toHaveLength(10);
    expect(results.at(-1)).toMatchObject({ ok: false, error: "rate_limited" });
  });
});

describe("PIN de empleado y recuperación", () => {
  it("bloquea tras varios intentos fallidos, incluso con el PIN correcto", async () => {
    for (let i = 0; i < 6; i++) {
      expect(await staffLogin("cafe-a", "0000", "ip-pin")).toMatchObject({ ok: false, error: "invalid" });
    }
    expect(await staffLogin("cafe-a", "4821", "ip-pin")).toMatchObject({ ok: false, error: "rate_limited" });
  });

  it("no permite PIN repetido dentro del negocio ni PIN obvio", async () => {
    expect(await rpc(user(ownerA), "owner_save_staff", [bizA, null, "Otra", "4821", true]))
      .toMatchObject({ ok: false, error: "pin_taken" });
    expect(await rpc(user(ownerA), "owner_save_staff", [bizA, null, "Otra", "1111", true]))
      .toMatchObject({ ok: false, error: "weak_pin" });
  });

  it("desactivar a un empleado cierra su sesión", async () => {
    const id = await createStaff(ownerA, bizA, "Temporal", "9182");
    const s = (await staffLogin("cafe-a", "9182", "ip-tmp")).token;
    const c = await newCustomer("cafe-a");
    await rpc(user(ownerA), "owner_save_staff", [bizA, id, "Temporal", null, false]);
    expect(await rpc(service, "stamp_customer", [s, c.id])).toMatchObject({ error: "unauthorized" });
  });

  it("el código de recuperación es de un solo uso y anula el enlace anterior", async () => {
    const c = await newCustomer("cafe-a");
    const code = (await rpc(service, "create_recovery_code", [sessionA, c.id])).code;
    const claim = await rpc(service, "claim_recovery_code", [code, "ip-rec"]);
    expect(claim).toMatchObject({ ok: true, slug: "cafe-a" });
    expect(await rpc(service, "get_customer_card", [c.token])).toBeNull();
    expect(await rpc(service, "get_customer_card", [claim.token])).not.toBeNull();
    expect(await rpc(service, "claim_recovery_code", [code, "ip-rec"])).toMatchObject({ ok: false, error: "invalid" });
  });

  it("un empleado no puede generar recuperación para clientes de otro negocio", async () => {
    const b = await newCustomer("fonda-b");
    expect(await rpc(service, "create_recovery_code", [sessionA, b.id])).toMatchObject({ ok: false, error: "not_found" });
  });
});

describe("Superadmin", () => {
  it("el resumen de la plataforma solo es accesible para el superadmin", async () => {
    const rows = await as<{ slug: string }>(user(adminId), "select slug from public.admin_overview()");
    expect(rows.map((r) => r.slug)).toEqual(expect.arrayContaining(["cafe-a", "fonda-b"]));
    await expect(as(user(ownerA), "select * from public.admin_overview()")).rejects.toThrow(/forbidden/);
  });
});
