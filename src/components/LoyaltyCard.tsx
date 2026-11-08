import { StampIcon } from "@/components/StampIcon";
import { brandTheme } from "@/lib/colors";
import { stampsWord } from "@/lib/program";

export type LoyaltyCardProps = {
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  stampIcon: string;
  stampsRequired: number;
  stamps: number;
  giftStamps: number;
  rewardFinal: string;
  rewardMid?: string | null;
  rewardMidAt?: number | null;
  midRedeemed?: boolean;
  customerName?: string;
  /** Índice desde el que se anima la aparición de sellos nuevos. */
  animateFrom?: number | null;
  footer?: React.ReactNode;
};

export function LoyaltyCard(p: LoyaltyCardProps) {
  const t = brandTheme(p.primaryColor, p.secondaryColor);
  const total = p.stampsRequired;
  const stamps = Math.min(p.stamps, total);
  const remaining = Math.max(0, total - stamps);
  const cols = total <= 8 ? 4 : total <= 10 ? 5 : total <= 12 ? 4 : 5;
  const initials = p.businessName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5" style={{ background: t.background, color: t.text }}
      data-testid="loyalty-card">
      <div className="flex items-center gap-3 px-5 py-4" style={{ background: t.primary, color: t.onPrimary }}>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm">
          {p.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logoUrl} alt={`Logo de ${p.businessName}`} className="h-full w-full object-contain p-1" />
          ) : (
            <span className="text-lg font-bold" style={{ color: t.primary === "#ffffff" ? "#111" : t.primary }}>{initials}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Tarjeta de lealtad</p>
          <h2 className="truncate text-xl font-bold leading-tight">{p.businessName}</h2>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        {p.customerName && (
          <p className="mb-3 text-sm" style={{ color: t.muted }}>
            Hola, <span className="font-semibold" style={{ color: t.text }}>{p.customerName}</span>
          </p>
        )}

        <ol className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          aria-label={`${stamps} de ${total} sellos`}>
          {Array.from({ length: total }, (_, i) => {
            const filled = i < stamps;
            const isGift = filled && i < p.giftStamps;
            const isMid = p.rewardMidAt && i === p.rewardMidAt - 1;
            const isLast = i === total - 1;
            const animate = filled && p.animateFrom != null && i >= p.animateFrom;
            return (
              <li key={i} className="relative">
                <div
                  className={`flex aspect-square items-center justify-center rounded-full ${filled ? "" : "border-2 border-dashed"} ${animate ? "stamp-pop stamp-ripple" : ""}`}
                  style={filled
                    ? { background: t.primary, color: t.onPrimary, animationDelay: animate ? `${(i - (p.animateFrom ?? 0)) * 180}ms` : undefined }
                    : { borderColor: t.accent, color: t.accent, opacity: 0.55 }}
                  data-filled={filled ? "1" : "0"}
                >
                  {filled ? (
                    <StampIcon name={p.stampIcon} className="h-3/5 w-3/5" />
                  ) : isLast || isMid ? (
                    <StampIcon name="regalo" className="h-1/2 w-1/2" />
                  ) : (
                    <span className="text-sm font-semibold">{i + 1}</span>
                  )}
                </div>
                {isGift && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-1.5 text-[9px] font-bold uppercase text-stone-700 shadow">
                    regalo
                  </span>
                )}
                {isMid && !filled && (
                  <span className="sr-only">Premio intermedio: {p.rewardMid}</span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${t.text} 12%, transparent)` }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(stamps / total) * 100}%`, background: t.accent }} />
          </div>
          <p className="mt-3 text-base font-semibold" data-testid="card-status">
            {remaining > 0
              ? <>Te {remaining === 1 ? "falta" : "faltan"} {stampsWord(remaining)} para: {p.rewardFinal}</>
              : <>¡Tarjeta completa! Pide tu premio: {p.rewardFinal}</>}
          </p>
          <p className="text-sm" style={{ color: t.muted }}>
            {stamps} de {total} sellos{p.giftStamps > 0 ? ` · ${p.giftStamps} de regalo` : ""}
          </p>
          {p.rewardMid && p.rewardMidAt && (
            <p className="mt-1 text-sm" style={{ color: t.muted }}>
              {p.midRedeemed
                ? `Premio de ${p.rewardMidAt} sellos ya canjeado ✓`
                : stamps >= p.rewardMidAt
                  ? `¡Ya puedes pedir tu premio intermedio: ${p.rewardMid}!`
                  : `A los ${p.rewardMidAt} sellos: ${p.rewardMid}`}
            </p>
          )}
        </div>
        {p.footer}
      </div>
    </div>
  );
}
