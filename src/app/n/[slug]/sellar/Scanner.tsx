"use client";

import jsQR from "jsqr";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/messages";
import type { StaffCustomerView } from "@/lib/types";
import { staffLogoutAction } from "../staff/actions";

type Props = { slug: string; businessName: string; staffName: string; primary: string; onPrimary: string; suspended: boolean };
type CamState = "starting" | "on" | "denied" | "unavailable";
type LastStamp = { eventId: string; name: string; at: number };
type Success = { name: string; amount: number; stamps: number; total: number; redeemed?: string };
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

const UNDO_MS = 2 * 60 * 1000;

async function api<T = Record<string, unknown>>(action: string, body: unknown): Promise<T & { ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/staff/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return await res.json();
  } catch {
    return { ok: false, error: "network" } as T & { ok: boolean; error?: string };
  }
}

function blockedText(c: StaffCustomerView) {
  switch (c.blocked_reason) {
    case "cooldown":
      return `Ya recibió un sello hace poco. Podrá recibir otro en ${c.wait_minutes} min.`;
    case "card_full":
      return "Tarjeta completa: canjea el premio para seguir sellando.";
    default:
      return errorMessage(c.blocked_reason);
  }
}

export function Scanner({ slug, businessName, staffName, primary, onPrimary, suspended }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const scanningRef = useRef(true);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);

  const [mode, setMode] = useState<"camera" | "phone">("camera");
  const [cam, setCam] = useState<CamState>("starting");
  const [sheet, setSheet] = useState<StaffCustomerView | null>(null);
  const [confirmRedeem, setConfirmRedeem] = useState<"final" | "mid" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "info" } | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [last, setLast] = useState<LastStamp | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [digits, setDigits] = useState("");
  const [results, setResults] = useState<{ customer_id: string; name: string; phone_masked: string }[] | null>(null);
  const [recovery, setRecovery] = useState<{ name: string; qr: string } | null>(null);
  const [lookupMs, setLookupMs] = useState<number | null>(null);

  const handleUnauthorized = useCallback((error?: string) => {
    if (error === "unauthorized") window.location.href = `/n/${slug}/staff`;
  }, [slug]);

  const showNotice = (text: string, tone: "error" | "info" = "error") => {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const resumeScanning = useCallback(() => {
    setSheet(null);
    setConfirmRedeem(null);
    scanningRef.current = true;
  }, []);

  const openCustomer = useCallback(async (body: { qr?: string; customer_id?: string }) => {
    scanningRef.current = false;
    setBusy(true);
    const t0 = performance.now();
    const r = await api<{ customer: StaffCustomerView }>("lookup", body);
    setLookupMs(Math.round(performance.now() - t0));
    setBusy(false);
    if (!r.ok) {
      handleUnauthorized(r.error);
      showNotice(r.error === "not_found" ? "Código no reconocido. ¿Es una tarjeta de este negocio?" : errorMessage(r.error));
      window.setTimeout(() => { scanningRef.current = true; }, 1500);
      return;
    }
    if ("vibrate" in navigator) navigator.vibrate?.(40);
    setSheet(r.customer);
  }, [handleUnauthorized]);

  // ---------------- Cámara ----------------
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("unavailable");
      return;
    }
    setCam("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      // Lector nativo (Android/Chrome); en iPhone se usa jsQR
      const BD = (window as unknown as { BarcodeDetector?: { new (o: unknown): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      if (BD && !detectorRef.current) {
        try {
          const formats = (await BD.getSupportedFormats?.()) ?? [];
          if (formats.includes("qr_code")) detectorRef.current = new BD({ formats: ["qr_code"] });
        } catch { /* se usa jsQR */ }
      }
      setCam("on");
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setCam(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
  }, []);

  useEffect(() => {
    if (mode !== "camera") { stopCamera(); return; }
    startCamera();
    const onVis = () => (document.visibilityState === "visible" ? startCamera() : stopCamera());
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); stopCamera(); };
  }, [mode, startCamera, stopCamera]);

  // Bucle de lectura (~8 cuadros por segundo)
  useEffect(() => {
    if (mode !== "camera" || cam !== "on") return;
    let stopped = false;
    let lastTick = 0;
    let raf = 0;
    const tick = async (ts: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      if (ts - lastTick < 120 || !scanningRef.current) return;
      lastTick = ts;
      const v = videoRef.current;
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      let value: string | null = null;
      try {
        if (detectorRef.current) {
          const codes = await detectorRef.current.detect(v);
          value = codes[0]?.rawValue ?? null;
        } else {
          const scale = Math.min(1, 640 / v.videoWidth);
          const w = Math.round(v.videoWidth * scale);
          const h = Math.round(v.videoHeight * scale);
          canvasRef.current ??= document.createElement("canvas");
          const c = canvasRef.current;
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          value = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
        }
      } catch { /* cuadro ilegible */ }
      if (!value || !scanningRef.current) return;
      const code = value.trim();
      const prev = lastCodeRef.current;
      if (prev && prev.code === code && Date.now() - prev.at < 2500) return;
      lastCodeRef.current = { code, at: Date.now() };
      openCustomer({ qr: code });
    };
    raf = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }, [mode, cam, openCustomer]);

  // Reloj para la cuenta regresiva de "Deshacer"
  useEffect(() => {
    if (!last) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() - last.at > UNDO_MS) setLast(null);
    }, 1000);
    return () => window.clearInterval(id);
  }, [last]);

  // ---------------- Acciones ----------------
  const stamp = async () => {
    if (!sheet) return;
    setBusy(true);
    const r = await api<{ event_id: string; amount: number; customer: StaffCustomerView; wait_minutes?: number }>("stamp", { customer_id: sheet.customer_id });
    setBusy(false);
    if (!r.ok) {
      handleUnauthorized(r.error);
      if (r.error === "cooldown") showNotice(`Ya recibió un sello hace poco. Podrá recibir otro en ${r.wait_minutes} min.`);
      else showNotice(errorMessage(r.error));
      return;
    }
    if ("vibrate" in navigator) navigator.vibrate?.([30, 30, 80]);
    setLast({ eventId: r.event_id, name: sheet.name, at: Date.now() });
    setNow(Date.now());
    setSuccess({ name: sheet.name, amount: r.amount, stamps: r.customer.state.stamps, total: r.customer.stamps_required });
    setSheet(null);
    window.setTimeout(() => { setSuccess(null); scanningRef.current = true; }, 1800);
  };

  const redeem = async (kind: "final" | "mid") => {
    if (!sheet) return;
    setBusy(true);
    const r = await api<{ customer: StaffCustomerView }>("redeem", { customer_id: sheet.customer_id, kind });
    setBusy(false);
    setConfirmRedeem(null);
    if (!r.ok) {
      handleUnauthorized(r.error);
      showNotice(errorMessage(r.error));
      return;
    }
    const reward = kind === "final" ? sheet.reward_final : sheet.reward_mid ?? "";
    setSuccess({ name: sheet.name, amount: 0, stamps: r.customer.state.stamps, total: r.customer.stamps_required, redeemed: reward });
    // Tras canjear, puede recibir el sello de esta visita en la tarjeta nueva
    setSheet(r.customer);
    window.setTimeout(() => setSuccess(null), 1800);
  };

  const undo = async () => {
    if (!last) return;
    setBusy(true);
    const r = await api("undo", { event_id: last.eventId });
    setBusy(false);
    if (!r.ok) {
      handleUnauthorized(r.error);
      showNotice(errorMessage(r.error));
      if (r.error === "undo_expired" || r.error === "card_redeemed") setLast(null);
      return;
    }
    showNotice(`Sello de ${last.name} deshecho.`, "info");
    setLast(null);
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = digits.replace(/\D/g, "");
    if (d.length < 4) { showNotice("Escribe al menos 4 dígitos del teléfono."); return; }
    setBusy(true);
    const r = await api<{ results: typeof results }>("search", { digits: d.slice(-10) });
    setBusy(false);
    if (!r.ok) { handleUnauthorized(r.error); showNotice(errorMessage(r.error)); return; }
    setResults(r.results ?? []);
  };

  const makeRecovery = async () => {
    if (!sheet) return;
    setBusy(true);
    const r = await api<{ url: string }>("recovery", { customer_id: sheet.customer_id });
    setBusy(false);
    if (!r.ok) { handleUnauthorized(r.error); showNotice(errorMessage(r.error)); return; }
    const qr = await QRCode.toDataURL(r.url, { margin: 1, width: 600, errorCorrectionLevel: "M" });
    setRecovery({ name: sheet.name, qr });
  };

  const undoLeft = last ? Math.max(0, UNDO_MS - (now - last.at)) : 0;
  const mmss = `${Math.floor(undoLeft / 60000)}:${String(Math.floor((undoLeft % 60000) / 1000)).padStart(2, "0")}`;

  return (
    <main className="flex min-h-dvh flex-col bg-stone-950 text-white">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{businessName}</p>
          <p className="text-xs text-stone-400">Atiende: {staffName}</p>
        </div>
        <form action={staffLogoutAction.bind(null, slug)}>
          <button className="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300">Salir</button>
        </form>
      </header>

      {suspended && (
        <p className="mx-4 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-200">
          El negocio está suspendido: no se pueden agregar sellos. Sí puedes canjear premios ya ganados.
        </p>
      )}

      <div className="mx-4 mt-2 grid grid-cols-2 rounded-xl bg-stone-900 p-1 text-sm font-semibold" role="tablist">
        <button role="tab" aria-selected={mode === "camera"} onClick={() => { setMode("camera"); setResults(null); }}
          className={`rounded-lg py-2 ${mode === "camera" ? "bg-white text-stone-900" : "text-stone-300"}`}>Cámara</button>
        <button role="tab" aria-selected={mode === "phone"} onClick={() => setMode("phone")}
          className={`rounded-lg py-2 ${mode === "phone" ? "bg-white text-stone-900" : "text-stone-300"}`}>Buscar teléfono</button>
      </div>

      {mode === "camera" ? (
        <section className="relative mx-4 mt-3 flex-1 overflow-hidden rounded-3xl bg-black" aria-label="Cámara">
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-square w-3/4 max-w-[320px] rounded-3xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          <p className="absolute inset-x-0 bottom-4 text-center text-sm font-medium text-white drop-shadow">
            {cam === "on" ? (busy ? "Buscando…" : "Apunta al código QR del cliente") : cam === "starting" ? "Abriendo cámara…" : ""}
          </p>
          {(cam === "denied" || cam === "unavailable") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-900 p-6 text-center">
              <p className="font-semibold">{cam === "denied" ? "No hay permiso para usar la cámara." : "No se pudo abrir la cámara."}</p>
              <p className="text-sm text-stone-400">
                {cam === "denied"
                  ? "En iPhone: Ajustes › Safari › Cámara › Permitir. En Android: toca el candado junto a la dirección › Permisos › Cámara."
                  : "Puedes buscar al cliente por su teléfono."}
              </p>
              <div className="flex gap-2">
                <button className="btn bg-white text-stone-900" onClick={startCamera}>Reintentar</button>
                <button className="btn border border-stone-600" onClick={() => setMode("phone")}>Buscar teléfono</button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="mx-4 mt-3 flex-1">
          <form onSubmit={search} className="flex gap-2">
            <label htmlFor="digits" className="sr-only">Teléfono del cliente</label>
            <input id="digits" inputMode="numeric" autoComplete="off" placeholder="Teléfono o últimos 4 dígitos"
              value={digits} onChange={(e) => setDigits(e.target.value.replace(/[^\d ]/g, ""))}
              className="min-w-0 flex-1 rounded-xl border border-stone-700 bg-stone-900 px-3 py-3 text-lg text-white placeholder:text-stone-500" />
            <button className="btn shrink-0" style={{ background: primary, color: onPrimary }} disabled={busy}>Buscar</button>
          </form>
          <ul className="mt-3 space-y-2" data-testid="search-results">
            {results?.length === 0 && <li className="rounded-xl bg-stone-900 p-4 text-stone-400">Sin resultados.</li>}
            {results?.map((r) => (
              <li key={r.customer_id}>
                <button className="flex w-full items-center justify-between rounded-xl bg-stone-900 p-4 text-left active:bg-stone-800"
                  onClick={() => openCustomer({ customer_id: r.customer_id })}>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-stone-400">{r.phone_masked}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Barra para deshacer el último sello (2 minutos) */}
      <div className="h-20 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
        {last && undoLeft > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-800 px-4 py-3" data-testid="undo-bar">
            <span className="min-w-0 truncate text-sm">Sello a <strong>{last.name}</strong></span>
            <button onClick={undo} disabled={busy} className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-bold text-stone-900">
              Deshacer ({mmss})
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div role="alert" className={`toast-in fixed inset-x-4 top-4 z-50 rounded-2xl p-4 text-center font-semibold shadow-xl ${notice.tone === "error" ? "bg-red-600" : "bg-stone-700"}`}>
          {notice.text}
        </div>
      )}

      {/* Hoja de confirmación */}
      {sheet && !success && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={resumeScanning}>
          <div className="sheet-up w-full rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),20px)] text-stone-900"
            onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Cliente ${sheet.name}`} data-testid="confirm-sheet" data-lookup-ms={lookupMs ?? undefined}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-2xl font-bold">{sheet.name}</p>
                <p className="text-sm text-stone-500">{sheet.phone_masked} · {sheet.state.total_visits} visitas</p>
              </div>
              <p className="shrink-0 rounded-xl bg-stone-100 px-3 py-2 text-center">
                <span className="block text-2xl font-black leading-none">{sheet.state.stamps}/{sheet.stamps_required}</span>
                <span className="text-[11px] text-stone-500">sellos</span>
              </p>
            </div>

            {confirmRedeem ? (
              <div className="mt-5 space-y-3">
                <p className="rounded-xl bg-emerald-50 p-4 text-lg">
                  ¿Entregaste el premio <strong>{confirmRedeem === "final" ? sheet.reward_final : sheet.reward_mid}</strong>?
                  {confirmRedeem === "final" && <span className="block text-sm text-stone-600">La tarjeta volverá a empezar en cero.</span>}
                </p>
                <button onClick={() => redeem(confirmRedeem)} disabled={busy} className="btn w-full bg-emerald-600 py-4 text-lg text-white">
                  Sí, confirmar canje
                </button>
                <button onClick={() => setConfirmRedeem(null)} className="btn-secondary w-full">Volver</button>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {sheet.can_stamp ? (
                  <button onClick={stamp} disabled={busy} className="btn w-full py-5 text-xl shadow-lg"
                    style={{ background: primary, color: onPrimary }} data-testid="stamp-button" autoFocus>
                    {busy ? "Sellando…" : sheet.multiplier > 1 ? "Sellar +2 · doble sello" : "Sellar +1"}
                  </button>
                ) : (
                  <p className="rounded-xl bg-amber-50 p-4 font-medium text-amber-900" data-testid="blocked-reason">{blockedText(sheet)}</p>
                )}
                {sheet.can_redeem_final && (
                  <button onClick={() => setConfirmRedeem("final")} className="btn w-full bg-emerald-600 py-4 text-lg text-white" data-testid="redeem-final">
                    Canjear premio: {sheet.reward_final}
                  </button>
                )}
                {sheet.can_redeem_mid && (
                  <button onClick={() => setConfirmRedeem("mid")} className="btn w-full border-2 border-emerald-600 py-3 text-emerald-800">
                    Canjear premio intermedio: {sheet.reward_mid}
                  </button>
                )}
                <div className="flex gap-2">
                  <button onClick={resumeScanning} className="btn-secondary flex-1">Cancelar</button>
                  <button onClick={makeRecovery} disabled={busy} className="btn-secondary flex-1 text-sm">Recuperar tarjeta</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmación visual del sello */}
      {success && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-emerald-600 p-6 text-center" role="status" data-testid="success">
          <div className="check-in flex h-28 w-28 items-center justify-center rounded-full bg-white text-6xl text-emerald-600">✓</div>
          {success.redeemed ? (
            <p className="mt-6 text-3xl font-black">Premio canjeado</p>
          ) : (
            <p className="mt-6 text-4xl font-black">+{success.amount} {success.amount === 1 ? "sello" : "sellos"}</p>
          )}
          <p className="mt-2 text-xl">{success.name}</p>
          <p className="mt-1 text-lg opacity-90">{success.stamps} de {success.total}{success.stamps >= success.total ? " · ¡Tarjeta completa!" : ""}</p>
        </div>
      )}

      {recovery && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-6 text-center text-stone-900" role="dialog" aria-modal="true">
          <p className="text-xl font-bold">Recuperar tarjeta de {recovery.name}</p>
          <p className="mt-2 max-w-xs text-stone-600">Pide al cliente que escanee este código con la cámara de su celular. Vence en 10 minutos y sirve una sola vez.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recovery.qr} alt="Código QR de recuperación" className="mt-5 w-full max-w-[300px]" />
          <button className="btn-primary mt-6" onClick={() => { setRecovery(null); resumeScanning(); }}>Listo</button>
        </div>
      )}
    </main>
  );
}
