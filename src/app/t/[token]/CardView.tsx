"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Conditions } from "@/components/Conditions";
import { InstallHint } from "@/components/InstallHint";
import { LoyaltyCard } from "@/components/LoyaltyCard";
import { brandTheme } from "@/lib/colors";
import type { CustomerCard } from "@/lib/types";
import { deleteAccountAction, setMarketingAction } from "./actions";

type Toast = { text: string; tone: "ok" | "info" } | null;

const HISTORY_LABELS: Record<string, string> = {
  signup_gift: "Sellos de regalo por registrarte",
  visit: "Sello por visita",
  redeem_final: "Premio canjeado",
  redeem_mid: "Premio intermedio canjeado",
};

export function CardView({ token, initial, qrSvg, logo, welcome }: {
  token: string; initial: CustomerCard; qrSvg: string; logo: string | null; welcome: boolean;
}) {
  const [card, setCard] = useState(initial);
  const [animateFrom, setAnimateFrom] = useState<number | null>(welcome ? 0 : null);
  const [toast, setToast] = useState<Toast>(welcome ? { text: `¡Bienvenido! Ya tienes ${initial.state.stamps} sellos de regalo.`, tone: "ok" } : null);
  const [showQr, setShowQr] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const prev = useRef(initial.state);
  const b = card.business;
  const t = brandTheme(b.primary_color, b.secondary_color);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/tarjeta/${token}`, { cache: "no-store" });
      if (!res.ok) return;
      const next: CustomerCard = await res.json();
      const before = prev.current;
      if (next.state.cycle > before.cycle) {
        setToast({ text: "¡Premio canjeado! Tu tarjeta empieza de nuevo.", tone: "ok" });
        setAnimateFrom(null);
        setShowQr(false);
      } else if (next.state.stamps > before.stamps) {
        const added = next.state.stamps - before.stamps;
        setAnimateFrom(before.stamps);
        setShowQr(false);
        setToast({ text: added > 1 ? `¡Recibiste ${added} sellos!` : "¡Recibiste un sello!", tone: "ok" });
        if ("vibrate" in navigator) navigator.vibrate?.([60, 40, 120]);
      } else if (next.state.stamps < before.stamps) {
        setAnimateFrom(null);
        setToast({ text: "Se corrigió un sello en tu tarjeta.", tone: "info" });
      }
      prev.current = next.state;
      setCard(next);
    } catch {
      /* sin conexión: se intenta de nuevo */
    }
  }, [token]);

  // Revisa cambios cada pocos segundos mientras la tarjeta está visible (más seguido con el QR abierto)
  useEffect(() => {
    const ms = showQr ? 2000 : 5000;
    const id = setInterval(() => document.visibilityState === "visible" && refresh(), ms);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [refresh, showQr]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const shareLink = async () => {
    const url = window.location.origin + `/t/${token}`;
    const text = `Mi tarjeta de ${b.name}: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Mi tarjeta de ${b.name}`, url }); return; } catch { /* cancelado */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const program = b.program;
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-12 pt-5" style={{ background: `linear-gradient(180deg, ${t.background} 0%, #f8f7f4 60%)` }}>
      {toast && (
        <div role="status" aria-live="polite" className="toast-in fixed inset-x-4 top-4 z-40 mx-auto max-w-md rounded-2xl px-4 py-3 text-center font-semibold shadow-lg"
          style={{ background: toast.tone === "ok" ? t.primary : "#1c1917", color: toast.tone === "ok" ? t.onPrimary : "#fff" }}>
          {toast.text}
        </div>
      )}

      <LoyaltyCard
        businessName={b.name}
        logoUrl={logo}
        primaryColor={b.primary_color}
        secondaryColor={b.secondary_color}
        stampIcon={b.stamp_icon}
        stampsRequired={program.stamps_required}
        stamps={card.state.stamps}
        giftStamps={card.state.gift_stamps}
        rewardFinal={program.reward_final}
        rewardMid={program.reward_mid}
        rewardMidAt={program.reward_mid_at}
        midRedeemed={card.state.mid_redeemed}
        customerName={card.customer.name}
        animateFrom={animateFrom}
      />

      {b.status === "suspended" && (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          La tarjeta de {b.name} está en pausa por el momento. Tus sellos están a salvo.
        </p>
      )}

      <button type="button" onClick={() => setShowQr(true)} className="btn mt-5 w-full py-4 text-lg shadow-md"
        style={{ background: t.primary, color: t.onPrimary }} data-testid="show-qr">
        Mostrar mi código para sellar
      </button>
      <p className="mt-2 text-center text-xs text-stone-500">Muéstralo en caja. Solo el personal puede agregar sellos.</p>

      <InstallHint businessName={b.name} />

      <Conditions program={program} timezone={b.timezone} className="mt-5" />

      <section className="card mt-5">
        <button type="button" className="flex w-full items-center justify-between font-semibold" onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}>
          Mis movimientos <span aria-hidden>{showHistory ? "−" : "+"}</span>
        </button>
        {showHistory && (
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {card.history.length === 0 && <li className="py-2 text-stone-500">Aún no hay movimientos.</li>}
            {card.history.map((h, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span>
                  {HISTORY_LABELS[h.kind] ?? h.kind}
                  {h.amount > 1 && h.kind === "visit" ? ` (×${h.amount}${h.is_double ? " doble" : ""})` : ""}
                  {h.kind === "signup_gift" ? ` (${h.amount})` : ""}
                </span>
                <span className="shrink-0 text-stone-500">
                  {new Intl.DateTimeFormat("es-MX", { timeZone: b.timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(h.at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-5 space-y-4 text-sm">
        <h2 className="text-base font-semibold">Mi tarjeta y privacidad</h2>
        <div>
          <p className="text-stone-600">Este enlace es tu tarjeta. Guárdalo y no lo compartas con nadie.</p>
          <button type="button" onClick={shareLink} className="btn-secondary mt-2 w-full">Guardar enlace (enviármelo por WhatsApp)</button>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span>Recibir promociones por WhatsApp</span>
          <input type="checkbox" className="h-6 w-6 accent-stone-900" checked={card.customer.marketing_opt_in}
            data-testid="marketing-toggle"
            onChange={(e) => {
              const v = e.target.checked;
              // Actualización optimista: la casilla cambia al instante y se revierte si falla
              setCard((c) => ({ ...c, customer: { ...c.customer, marketing_opt_in: v } }));
              startTransition(async () => {
                const r = await setMarketingAction(token, v).catch(() => ({ ok: false }));
                if (!(r as { ok?: boolean })?.ok) {
                  setCard((c) => ({ ...c, customer: { ...c.customer, marketing_opt_in: !v } }));
                  setToast({ text: "No se pudo guardar tu preferencia. Intenta de nuevo.", tone: "info" });
                  return;
                }
                setToast({ text: v ? "Recibirás promociones por WhatsApp." : "Ya no recibirás promociones.", tone: "info" });
              });
            }} />
        </label>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Link href={`/n/${b.slug}/privacidad`} className="underline">Aviso de privacidad</Link>
          <Link href={`/n/${b.slug}/terminos`} className="underline">Términos</Link>
        </div>
        {!confirmDelete ? (
          <button type="button" className="text-sm font-medium text-red-700 underline" onClick={() => setConfirmDelete(true)}>
            Dar de baja mi cuenta
          </button>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="font-medium text-red-900">¿Seguro? Se borrarán tu nombre, teléfono y cumpleaños, y perderás tus sellos.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button type="button" className="btn-danger flex-1" disabled={pending}
                onClick={() => startTransition(async () => { await deleteAccountAction(token); })}>
                Sí, dar de baja
              </button>
            </div>
          </div>
        )}
      </section>

      {showQr && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-6" role="dialog" aria-modal="true"
          aria-label="Mi código para sellar" onClick={() => setShowQr(false)}>
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">{b.name}</p>
          <p className="mt-1 text-2xl font-bold">{card.customer.name}</p>
          <div className="mt-6 w-full max-w-[320px] rounded-2xl border-8 p-2" style={{ borderColor: t.primary }}
            // El SVG lo genera el servidor con la librería qrcode (contenido de confianza)
            dangerouslySetInnerHTML={{ __html: qrSvg }} data-testid="qr" />
          <p className="mt-6 text-center text-lg font-semibold">{card.state.stamps} de {program.stamps_required} sellos</p>
          <p className="mt-2 max-w-xs text-center text-sm text-stone-600">
            Muestra este código en caja. Sube el brillo de tu pantalla si no lo leen.
          </p>
          <button type="button" className="btn-secondary mt-8">Cerrar</button>
        </div>
      )}
    </main>
  );
}
