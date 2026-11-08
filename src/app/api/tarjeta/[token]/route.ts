import { NextResponse } from "next/server";
import { callRpc } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const card = await callRpc("get_customer_card", { p_token: token });
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(card, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
