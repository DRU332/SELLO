"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Conditions } from "@/components/Conditions";
import { LoyaltyCard } from "@/components/LoyaltyCard";
import { STAMP_ICONS, StampIcon } from "@/components/StampIcon";
import { brandTheme, contrastReport } from "@/lib/colors";
import { DAY_SHORT } from "@/lib/program";
import type { OwnerBusiness } from "@/lib/auth";
import type { DoubleRule, Program } from "@/lib/types";
import { saveConfigAction, uploadLogoAction } from "./actions";

export function ConfigForm({ businessId, business, program, initialLogo }: {
  businessId: string; business: OwnerBusiness; program: Program; initialLogo: string | null;
}) {
  const [name, setName] = useState(business.name);
  const [primary, setPrimary] = useState(business.primary_color);
  const [secondary, setSecondary] = useState(business.secondary_color);
  const [icon, setIcon] = useState(business.stamp_icon);
  const [logo, setLogo] = useState(initialLogo);
  const [suggested, setSuggested] = useState<{ primary: string; secondary: string; palette: string[] } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();

  const [required, setRequired] = useState(program.stamps_required);
  const [gift, setGift] = useState(program.signup_gift);
  const [reward, setReward] = useState(program.reward_final);
  const [midOn, setMidOn] = useState(Boolean(program.reward_mid));
  const [mid, setMid] = useState(program.reward_mid ?? "");
  const [midAt, setMidAt] = useState(program.reward_mid_at ?? Math.max(1, Math.floor(program.stamps_required / 2)));
  const [validFrom, setValidFrom] = useState(program.valid_from ?? "");
  const [validUntil, setValidUntil] = useState(program.valid_until ?? "");
  const [restrictions, setRestrictions] = useState(program.restrictions);
  const [cooldown, setCooldown] = useState(program.cooldown_minutes);
  const [rules, setRules] = useState<DoubleRule[]>(program.double_rules ?? []);

  const [state, action, saving] = useActionState(saveConfigAction.bind(null, businessId), null);
  const theme = brandTheme(primary, secondary);
  const report = contrastReport(primary, secondary);
  const previewProgram: Program = {
    stamps_required: required, signup_gift: Math.min(gift, required - 1), reward_final: reward || "…",
    reward_mid: midOn ? mid || "…" : null, reward_mid_at: midOn ? midAt : null,
    valid_from: validFrom || null, valid_until: validUntil || null, restrictions, cooldown_minutes: cooldown, double_rules: rules,
  };

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    setLogoError(null);
    if (file.size > 1024 * 1024) { setLogoError("El logo pesa más de 1 MB. Usa uno más ligero."); return; }
    const fd = new FormData();
    fd.append("logo", file);
    startUpload(async () => {
      const r = await uploadLogoAction(businessId, fd);
      if (!r.ok) { setLogoError(r.error); return; }
      setLogo(r.url);
      setSuggested(r.suggestion);
      setPrimary(r.suggestion.primary);
      setSecondary(r.suggestion.secondary);
    });
  };

  const updateRule = (i: number, patch: Partial<DoubleRule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <form action={action} className="space-y-6">
        <input type="hidden" name="double_rules" value={JSON.stringify(rules)} />

        <fieldset className="card space-y-4">
          <legend className="px-1 text-lg font-semibold">Marca</legend>
          <div>
            <label className="label" htmlFor="name">Nombre del negocio</label>
            <input id="name" name="name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>
          <div>
            <span className="label">Logo</span>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {logo ? <img src={logo} alt="Logo actual" className="h-full w-full object-contain" /> : <span className="text-xs text-stone-400">Sin logo</span>}
              </div>
              <label className="btn-secondary cursor-pointer">
                {uploading ? "Subiendo…" : "Subir logo"}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,.svg" className="sr-only" data-testid="logo-input"
                  onChange={(e) => onLogo(e.target.files?.[0])} disabled={uploading} />
              </label>
            </div>
            <p className="mt-1 text-xs text-stone-500">PNG, JPG o SVG de hasta 1 MB. Lo ajustamos a cuadrado automáticamente.</p>
            {logoError && <p role="alert" className="mt-1 text-sm text-red-700">{logoError}</p>}
          </div>
          {suggested && (
            <div className="rounded-xl bg-stone-50 p-3 text-sm">
              <p className="font-medium">Colores sugeridos a partir de tu logo (ya aplicados, puedes cambiarlos):</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggested.palette.map((c) => (
                  <button key={c} type="button" onClick={() => setPrimary(c)} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1">
                    <span className="h-5 w-5 rounded" style={{ background: c }} /> {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <ColorInput id="primary_color" label="Color principal" value={primary} onChange={setPrimary} />
            <ColorInput id="secondary_color" label="Color secundario (fondo)" value={secondary} onChange={setSecondary} />
          </div>
          <ul className="space-y-1 text-sm" aria-label="Revisión de contraste">
            {report.map((r) => (
              <li key={r.label} className={r.ok ? "text-emerald-700" : "text-amber-700"}>
                {r.ok ? "✓" : "⚠"} {r.label}: {r.ratio.toFixed(1)}:1 {r.ok ? "legible" : "— lo ajustamos automáticamente"}
              </li>
            ))}
          </ul>
          <div>
            <span className="label">Icono del sello</span>
            <input type="hidden" name="stamp_icon" value={icon} />
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {STAMP_ICONS.map((s) => (
                <button key={s.id} type="button" onClick={() => setIcon(s.id)} aria-pressed={icon === s.id} title={s.label}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-xs ${icon === s.id ? "border-stone-900 ring-2 ring-stone-900/20" : "border-stone-200"}`}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: theme.primary, color: theme.onPrimary }}>
                    <StampIcon name={s.id} className="h-6 w-6" />
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="px-1 text-lg font-semibold">Reglas de la promoción</legend>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="stamps_required" label="Sellos necesarios" value={required} min={3} max={20} onChange={setRequired} />
            <NumberField id="signup_gift" label="Sellos de regalo al registrarse" value={gift} min={0} max={required - 1} onChange={setGift} />
          </div>
          <div>
            <label className="label" htmlFor="reward_final">Premio final</label>
            <input id="reward_final" name="reward_final" className="field" value={reward} onChange={(e) => setReward(e.target.value)} maxLength={120} required placeholder="Ej. Un café gratis" />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={midOn} onChange={(e) => setMidOn(e.target.checked)} className="h-5 w-5 accent-stone-900" />
            Premio intermedio (opcional)
          </label>
          {midOn ? (
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div>
                <label className="label" htmlFor="reward_mid">Premio intermedio</label>
                <input id="reward_mid" name="reward_mid" className="field" value={mid} onChange={(e) => setMid(e.target.value)} maxLength={120} placeholder="Ej. Un pan dulce" />
              </div>
              <NumberField id="reward_mid_at" label="Al sello número" value={midAt} min={1} max={required - 1} onChange={setMidAt} />
            </div>
          ) : (
            <><input type="hidden" name="reward_mid" value="" /><input type="hidden" name="reward_mid_at" value="" /></>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="valid_from">Vigencia desde (opcional)</label>
              <input id="valid_from" name="valid_from" type="date" className="field" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="valid_until">Vigencia hasta (opcional)</label>
              <input id="valid_until" name="valid_until" type="date" className="field" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="cooldown_minutes">Tiempo mínimo entre sellos al mismo cliente</label>
            <select id="cooldown_minutes" name="cooldown_minutes" className="field" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))}>
              {[0, 15, 30, 60, 120, 240, 480, 720, 1440].map((m) => (
                <option key={m} value={m}>{m === 0 ? "Sin límite" : m < 60 ? `${m} minutos` : m === 1440 ? "1 día" : `${m / 60} ${m === 60 ? "hora" : "horas"}`}{m === 30 ? " (recomendado)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="restrictions">Restricciones (se muestran en la tarjeta)</label>
            <textarea id="restrictions" name="restrictions" className="field h-20" value={restrictions} onChange={(e) => setRestrictions(e.target.value)} maxLength={500}
              placeholder="Ej. No aplica en días festivos. Bebida tamaño mediano." />
          </div>
          <div>
            <span className="label">Doble sello por día y horario</span>
            <div className="space-y-3">
              {rules.map((r, i) => (
                <div key={i} className="rounded-xl border border-stone-200 p-3">
                  <div className="flex flex-wrap gap-1">
                    {DAY_SHORT.map((d, di) => (
                      <button key={d} type="button" aria-pressed={r.days.includes(di)}
                        onClick={() => updateRule(i, { days: r.days.includes(di) ? r.days.filter((x) => x !== di) : [...r.days, di].sort() })}
                        className={`rounded-lg px-2.5 py-1.5 text-sm ${r.days.includes(di) ? "bg-stone-900 text-white" : "bg-stone-100"}`}>{d}</button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    de <input type="time" className="field w-auto py-2" value={r.from} onChange={(e) => updateRule(i, { from: e.target.value })} aria-label="Desde" />
                    a <input type="time" className="field w-auto py-2" value={r.to === "24:00" ? "23:59" : r.to} onChange={(e) => updateRule(i, { to: e.target.value })} aria-label="Hasta" />
                    <button type="button" className="ml-auto text-red-700 underline" onClick={() => setRules(rules.filter((_, j) => j !== i))}>Quitar</button>
                  </div>
                </div>
              ))}
              {rules.length < 5 && (
                <button type="button" className="btn-secondary text-sm" onClick={() => setRules([...rules, { days: [2], from: "16:00", to: "19:00" }])}>
                  + Agregar horario de doble sello
                </button>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="card space-y-4" id="ticket">
          <legend className="px-1 text-lg font-semibold">Reportes</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="avg_ticket_mxn">Ticket promedio (MXN)</label>
              <input id="avg_ticket_mxn" name="avg_ticket_mxn" type="number" min={0} max={99999} step="1" inputMode="decimal" className="field" defaultValue={business.avg_ticket_mxn} />
            </div>
            <div>
              <label className="label" htmlFor="at_risk_days">Cliente en riesgo tras (días)</label>
              <input id="at_risk_days" name="at_risk_days" type="number" min={7} max={365} className="field" defaultValue={business.at_risk_days} />
            </div>
            <div>
              <label className="label" htmlFor="frequent_min_visits">Frecuente desde (visitas)</label>
              <input id="frequent_min_visits" name="frequent_min_visits" type="number" min={2} max={50} className="field" defaultValue={business.frequent_min_visits} />
            </div>
          </div>
          <p className="text-xs text-stone-500">El ticket promedio se usa para calcular las ventas estimadas (siempre marcadas como «estimado»).</p>
        </fieldset>

        <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-2xl bg-white/90 p-3 shadow-lg ring-1 ring-stone-200 backdrop-blur">
          <button className="btn-primary flex-1" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
          {state?.ok && <p role="status" className="text-sm font-medium text-emerald-700">✓ Guardado</p>}
          {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        </div>
      </form>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-sm font-semibold text-stone-500">Vista previa en vivo</p>
        <div data-testid="preview">
          <LoyaltyCard businessName={name || "Tu negocio"} logoUrl={logo} primaryColor={primary} secondaryColor={secondary}
            stampIcon={icon} stampsRequired={required} stamps={Math.min(gift + 3, required)} giftStamps={Math.min(gift, required - 1)}
            rewardFinal={reward || "…"} rewardMid={midOn ? mid : null} rewardMidAt={midOn ? midAt : null} customerName="Mariana" />
        </div>
        <Conditions program={previewProgram} timezone={business.timezone} className="mt-4" />
      </aside>
    </div>
  );
}

function ColorInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2">
        <input id={id} type="color" value={value} onChange={(e) => { onChange(e.target.value); setText(e.target.value); }}
          className="h-12 w-14 shrink-0 cursor-pointer rounded-lg border border-stone-300 bg-white p-1" />
        <input id={`${id}-text`} className="field font-mono" value={text} maxLength={7} aria-label={`${label} (código)`}
          onChange={(e) => { const v = e.target.value.toLowerCase(); setText(v); if (/^#[0-9a-f]{6}$/.test(v)) onChange(v); }} />
        <input type="hidden" name={id} value={value} />
      </div>
    </div>
  );
}

function NumberField({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} name={id} type="number" inputMode="numeric" min={min} max={max} className="field" value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))} />
    </div>
  );
}
