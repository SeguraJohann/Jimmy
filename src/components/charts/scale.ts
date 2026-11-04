// Shared chart math: nice ticks and time axis labels.

import type { DateKey } from "@/types/models";
import { addMonths, diffDays, parseDateKey, startOfMonth } from "@/lib/date/dateKey";
import { axisMonth, dayMonth } from "@/lib/date/format";

export function niceStep(range: number, count: number): number {
  const raw = range / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

/** Nice [min, max] and ticks covering the values. */
export function niceScale(min: number, max: number, count = 4, zero = false): { min: number; max: number; ticks: number[] } {
  if (zero) min = Math.min(0, min);
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
    if (zero) min = Math.min(0, min);
  }
  const step = niceStep(max - min, count);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { min: lo, max: hi, ticks };
}

/** Up to ~6 date labels for a time axis [from, to]. */
export function timeTicks(from: DateKey, to: DateKey, today: DateKey): { date: DateKey; label: string }[] {
  const span = diffDays(from, to);
  if (span <= 0) return [{ date: from, label: dayMonth(from, today) }];
  if (span <= 70) {
    const step = Math.max(7, Math.ceil(span / 5 / 7) * 7);
    const out: { date: DateKey; label: string }[] = [];
    for (let d = 0; d <= span; d += step) {
      const k = addDaysKey(from, d);
      out.push({ date: k, label: dayMonth(k, today) });
    }
    return out;
  }
  const months = Math.ceil(span / 30);
  const every = Math.max(1, Math.ceil(months / 6));
  const out: { date: DateKey; label: string }[] = [];
  let m = startOfMonth(from) < from ? addMonths(startOfMonth(from), 1) : startOfMonth(from);
  let i = 0;
  while (m <= to) {
    if (i % every === 0) out.push({ date: m, label: axisMonth(m, today) });
    m = addMonths(m, 1);
    i++;
  }
  return out;
}

function addDaysKey(k: DateKey, n: number): DateKey {
  const { y, m, d } = parseDateKey(k);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}
