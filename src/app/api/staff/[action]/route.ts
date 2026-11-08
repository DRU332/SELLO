import { NextResponse } from "next/server";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { assertSameOrigin } from "@/lib/request";
import { getStaffToken } from "@/lib/staff-session";
import { callRpc } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const schemas = {
  lookup: z.object({ qr: z.string().regex(/^S1[0-9a-f]{36}$/).optional(), customer_id: uuid.optional() })
    .refine((v) => v.qr || v.customer_id),
  search: z.object({ digits: z.string().regex(/^\d{4,10}$/) }),
  stamp: z.object({ customer_id: uuid }),
  undo: z.object({ event_id: uuid }),
  redeem: z.object({ customer_id: uuid, kind: z.enum(["final", "mid"]) }),
  recovery: z.object({ customer_id: uuid }),
} as const;

type Action = keyof typeof schemas;

/**
 * API de la pantalla de sellado. Toda la validación (sesión del empleado,
 * negocio, bloqueo de doble sello, canje) ocurre en funciones de la base.
 */
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!(action in schemas)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!(await assertSameOrigin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const token = await getStaffToken();
  if (!token) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schemas[action as Action].safeParse(body);
  if (!parsed.success) {
    // Un QR con otro formato no es una tarjeta de este sistema
    return NextResponse.json({ ok: false, error: action === "lookup" ? "not_found" : "invalid" }, { status: 400 });
  }
  const d = parsed.data as Record<string, string>;

  let result: Record<string, unknown>;
  switch (action as Action) {
    case "lookup":
      result = await callRpc("staff_lookup", { p_session: token, p_qr_code: d.qr ?? null, p_customer_id: d.customer_id ?? null });
      break;
    case "search":
      result = await callRpc("staff_search_phone", { p_session: token, p_digits: d.digits });
      break;
    case "stamp":
      result = await callRpc("stamp_customer", { p_session: token, p_customer_id: d.customer_id });
      break;
    case "undo":
      result = await callRpc("undo_stamp", { p_session: token, p_event_id: d.event_id });
      break;
    case "redeem":
      result = await callRpc("redeem_reward", { p_session: token, p_customer_id: d.customer_id, p_kind: d.kind });
      break;
    case "recovery": {
      const r = await callRpc<{ ok: boolean; code?: string; error?: string }>("create_recovery_code", { p_session: token, p_customer_id: d.customer_id });
      result = r.ok ? { ok: true, url: `${publicEnv.appUrl}/r/${r.code}` } : r;
      break;
    }
  }
  const status = result.error === "unauthorized" ? 401 : 200;
  return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
