import type { ReactNode } from "react";
import type { ColorKey } from "@/types/models";
import type { TrendStatus } from "@/lib/metrics/trend";
import { TREND_COLOR, TREND_SYMBOL, TREND_TINT, colorVar } from "@/styles/semantic";
import { useT, fmt } from "@/i18n";
import { formatPercent } from "@/lib/utils/number";

interface SegProps<T extends string> {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label?: string;
  small?: boolean;
}

export function Segmented<T extends string>({ value, options, onChange, label, small }: SegProps<T>) {
  return (
    <div className={`seg ${small ? "sm" : ""}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Selectable chips that wrap (or scroll horizontally on one line). */
export function ChipSelect<T extends string>({
  value,
  options,
  onChange,
  scroll,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  scroll?: boolean;
  label?: string;
}) {
  return (
    <div className={`chips ${scroll ? "scroll" : ""}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={`chip ${o.value === value ? "sel" : ""}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "28px 16px", textAlign: "center" }}>
      <p className="muted" style={{ maxWidth: 440 }}>
        {children}
      </p>
      {action}
    </div>
  );
}

export function Loading({ full }: { full?: boolean }) {
  const t = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: full ? "100dvh" : 120 }}>
      <span className="muted">{t.app.loading}</span>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="card err-text" role="alert">
      {children}
    </p>
  );
}

export function TypeDot({ color, size = 10 }: { color: ColorKey | null | undefined; size?: number }) {
  return <i className="dot" style={{ background: colorVar(color), width: size, height: size }} />;
}

export function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}


/** "▲ Progresa +4,2 % / 4 sem" */
export function TrendBadge({ status, pct, compact }: { status: TrendStatus; pct?: number | null; compact?: boolean }) {
  const t = useT();
  const showPct = pct !== null && pct !== undefined && (status === "up" || status === "down" || status === "flat");
  return (
    <span className="chip" style={{ background: TREND_TINT[status], color: TREND_COLOR[status], borderColor: "transparent" }}>
      {TREND_SYMBOL[status]} {compact && showPct ? formatPercent(pct) : t.trend[status]}
      {!compact && showPct && <span style={{ opacity: 0.85 }}>{fmt(t.trend.per4w, { pct: formatPercent(pct) })}</span>}
    </span>
  );
}
