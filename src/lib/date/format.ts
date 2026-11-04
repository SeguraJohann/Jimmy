// Human-readable dates and durations (Spanish, week starts Monday).

import type { DateKey } from "@/types/models";
import { es, fmt, capitalize } from "@/i18n";
import { diffDays, parseDateKey, todayKey, weekdayOf } from "./dateKey";

const D = es.dates;

/** "martes 3 de noviembre" (adds the year when it is not the current one). */
export function longDate(key: DateKey, today: DateKey = todayKey()): string {
  const { y, m, d } = parseDateKey(key);
  const wd = D.weekdays[weekdayOf(key) - 1];
  const ty = parseDateKey(today).y;
  return y === ty ? fmt(D.longDate, { wd, d, month: D.months[m - 1] }) : fmt(D.longDateYear, { wd, d, month: D.months[m - 1], y });
}

/** "dom 1 nov" */
export function shortDate(key: DateKey): string {
  const { m, d } = parseDateKey(key);
  return fmt(D.shortDate, { wd: D.weekdaysShort[weekdayOf(key) - 1], d, month: D.monthsShort[m - 1] });
}

/** "1 nov" (with the year when it is not the current one: "1 nov 25"). */
export function dayMonth(key: DateKey, today: DateKey = todayKey()): string {
  const { y, m, d } = parseDateKey(key);
  const base = `${d} ${D.monthsShort[m - 1]}`;
  return y === parseDateKey(today).y ? base : `${base} ${String(y).slice(2)}`;
}

/** "Hoy" / "Ayer" / "dom 1 nov". */
export function relativeDate(key: DateKey, today: DateKey = todayKey()): string {
  const diff = diffDays(key, today);
  if (diff === 0) return D.Today;
  if (diff === 1) return D.Yesterday;
  return capitalize(shortDate(key));
}

/** "hoy" / "ayer" / "hace 5 días" / "hace 3 semanas" / "hace 2 meses". */
export function agoText(key: DateKey | null, today: DateKey = todayKey()): string {
  if (!key) return D.never;
  const diff = diffDays(key, today);
  if (diff <= 0) return D.today;
  if (diff === 1) return D.yesterday;
  if (diff < 14) return fmt(D.daysAgo, { n: diff });
  if (diff < 60) return fmt(D.weeksAgo, { n: Math.round(diff / 7) });
  return fmt(D.monthsAgo, { n: Math.round(diff / 30) });
}

/** "Noviembre 2026" */
export function monthYear(key: DateKey): string {
  const { y, m } = parseDateKey(key);
  return capitalize(fmt(D.monthYear, { month: D.months[m - 1], y }));
}

/** Short month label for chart axes: "nov" (or "nov 25" when not the current year). */
export function axisMonth(key: DateKey, today: DateKey = todayKey()): string {
  const { y, m } = parseDateKey(key);
  return y === parseDateKey(today).y ? D.monthsShort[m - 1] : `${D.monthsShort[m - 1]} ${String(y).slice(2)}`;
}

export function formatDuration(min: number): string {
  if (min < 60) return fmt(es.time.minutes, { n: min });
  return fmt(es.time.hoursMinutes, { h: Math.floor(min / 60), m: min % 60 });
}

/** Stopwatch "01:02:03". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}
