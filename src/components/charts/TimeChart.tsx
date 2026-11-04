// Time-proportional chart (C2): x is the date, not the session index.
// Draws points + a line (strength) or bars (volume), with an optional moving
// average and record markers. Pure SVG, colors from tokens.

import { useMemo } from "react";
import type { DateKey } from "@/types/models";
import { diffDays } from "@/lib/date/dateKey";
import { niceScale, timeTicks } from "./scale";
import styles from "./charts.module.css";

export interface TimePoint {
  date: DateKey;
  value: number;
  record?: boolean;
}

interface Props {
  points: TimePoint[];
  /** Moving average aligned with `points`. */
  average?: (number | null)[];
  kind: "line" | "bar";
  /** Domain start/end (defaults to the first/last point). */
  from?: DateKey;
  to?: DateKey;
  today: DateKey;
  formatValue: (v: number) => string;
  label: string;
  /** Start the y axis at zero (volume). */
  zero?: boolean;
  height?: number;
}

const W = 600;
const PAD = { l: 44, r: 14, t: 16, b: 26 };

export function TimeChart({ points, average, kind, from, to, today, formatValue, label, zero, height = 220 }: Props) {
  const H = height;
  const model = useMemo(() => {
    if (points.length === 0) return null;
    const start = from ?? points[0].date;
    const end = to ?? points[points.length - 1].date;
    const span = Math.max(1, diffDays(start, end));
    const values = points.map((p) => p.value).concat((average ?? []).filter((v): v is number => v !== null));
    const scale = niceScale(Math.min(...values), Math.max(...values), 4, zero || kind === "bar");
    const plotW = W - PAD.l - PAD.r;
    const x = (d: DateKey) => PAD.l + (diffDays(start, d) / span) * plotW;
    const y = (v: number) => PAD.t + ((scale.max - v) / (scale.max - scale.min || 1)) * (H - PAD.t - PAD.b);
    const barW = Math.max(3, Math.min(18, (plotW / Math.max(points.length, 1)) * 0.6));
    return { start, end, scale, x, y, barW, ticks: timeTicks(start, end, today) };
  }, [points, average, from, to, today, zero, kind, H]);

  if (!model) return null;
  const { scale, x, y, barW, ticks } = model;
  const last = points[points.length - 1];
  const avgPts = average
    ?.map((v, i) => (v === null ? null : `${x(points[i].date).toFixed(1)},${y(v).toFixed(1)}`))
    .filter((p): p is string => p !== null)
    .join(" ");

  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {scale.ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={styles.grid} />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className={styles.axis}>
            {formatValue(v)}
          </text>
        </g>
      ))}
      {ticks.map((tk) => (
        <text key={tk.date} x={x(tk.date)} y={H - 6} textAnchor="middle" className={styles.axis}>
          {tk.label}
        </text>
      ))}
      {kind === "bar" &&
        points.map((p, i) => (
          <rect
            key={`${p.date}-${i}`}
            x={Math.min(W - PAD.r - barW, Math.max(PAD.l, x(p.date) - barW / 2))}
            y={y(p.value)}
            width={barW}
            height={Math.max(0, y(scale.min) - y(p.value))}
            rx={2}
            className={p.record ? styles.barRecord : styles.bar}
          />
        ))}
      {kind === "line" && points.length > 1 && (
        <polyline points={points.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")} className={styles.line} />
      )}
      {avgPts && points.length > 2 && <polyline points={avgPts} className={styles.avg} />}
      {kind === "line" &&
        points.map((p, i) => (
          <circle key={`${p.date}-${i}`} cx={x(p.date)} cy={y(p.value)} r={p.record ? 5 : i === points.length - 1 ? 5 : 3} className={p.record ? styles.dotRecord : styles.dot} />
        ))}
      {kind === "line" && (
        <text x={Math.max(PAD.l + 30, x(last.date) - 8)} y={Math.max(12, y(last.value) - 12)} textAnchor="end" className={styles.lastLabel}>
          {formatValue(last.value)}
        </text>
      )}
    </svg>
  );
}

/** Tiny trend line for list rows. */
export function Sparkline({ values, color, width = 84, height = 28 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ flex: "none" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
