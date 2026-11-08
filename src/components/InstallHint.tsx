"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Instrucciones para guardar en la pantalla de inicio: iPhone (Safari) y Android (Chrome). */
export function InstallHint({ businessName }: { businessName: string }) {
  const [platform, setPlatform] = useState<"ios" | "android" | "other" | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setPlatform(isIos ? "ios" : /Android/i.test(ua) ? "android" : "other");
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!platform || standalone) return null;

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      setDeferred(null);
    } else {
      setOpen(true);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white/70 p-4 text-sm" data-testid="install-hint">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">Guarda tu tarjeta en la pantalla de inicio</p>
        <button type="button" className="btn-secondary shrink-0 px-3 py-2 text-sm" onClick={install}>
          {deferred ? "Instalar" : "¿Cómo?"}
        </button>
      </div>
      {open && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-stone-700">
          {platform === "ios" ? (
            <>
              <li>Abre esta página en <strong>Safari</strong>.</li>
              <li>Toca el botón <strong>Compartir</strong> (el cuadro con la flecha hacia arriba).</li>
              <li>Elige <strong>Agregar a inicio</strong> y luego <strong>Agregar</strong>.</li>
            </>
          ) : platform === "android" ? (
            <>
              <li>Abre esta página en <strong>Chrome</strong>.</li>
              <li>Toca el menú <strong>⋮</strong> (arriba a la derecha).</li>
              <li>Elige <strong>Agregar a la pantalla principal</strong> o <strong>Instalar app</strong>.</li>
            </>
          ) : (
            <li>Desde tu celular, abre esta página y usa la opción «Agregar a inicio» de tu navegador.</li>
          )}
          <li>Aparecerá el icono de {businessName}. ¡Listo!</li>
        </ol>
      )}
    </div>
  );
}
