// Cross-exercise aggregations for the Progress view and chart downsampling.
// See docs/ANALYTICS.md §4 and §6.

import type { DateKey, Exercise, ExerciseLog } from "@/types/models";
import { addDays, addMonths, diffDays, startOfMonth, startOfWeek } from "@/lib/date/dateKey";
import { matchesFilter, sessionPoint, type EntryFilter, type SessionPoint } from "./points";
import { primaryRecordSessions } from "./records";

export type Period = "4w" | "3m" | "6m" | "1y" | "all";

/** Inclusive date range of a period ending today. `all` starts at `firstDate`. */
export function periodRange(period: Period, today: DateKey, firstDate: DateKey | null): { from: DateKey; to: DateKey } {
  switch (period) {
    case "4w":
      return { from: addDays(today, -27), to: today };
    case "3m":
      return { from: addDays(addMonths(today, -3), 1), to: today };
    case "6m":
      return { from: addDays(addMonths(today, -6), 1), to: today };
    case "1y":
      return { from: addDays(addMonths(today, -12), 1), to: today };
    case "all":
      return { from: firstDate ?? today, to: today };
  }
}

/** The range of equal length right before `range`. */
export function previousRange(range: { from: DateKey; to: DateKey }): { from: DateKey; to: DateKey } {
  const len = diffDays(range.from, range.to) + 1;
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

export interface SessionMeta {
  date: DateKey;
  blockTypeIds: Set<string>;
}

/** Every session found in the logs (id → date + block types). */
export function sessionsFromLogs(logs: ExerciseLog[]): Map<string, SessionMeta> {
  const out = new Map<string, SessionMeta>();
  for (const log of logs) {
    for (const [sid, e] of Object.entries(log.entries)) {
      let m = out.get(sid);
      if (!m) out.set(sid, (m = { date: e.date, blockTypeIds: new Set() }));
      if (e.blockTypeId) m.blockTypeIds.add(e.blockTypeId);
    }
  }
  return out;
}

export function firstLogDate(logs: ExerciseLog[]): DateKey | null {
  let first: DateKey | null = null;
  for (const log of logs) for (const e of Object.values(log.entries)) if (first === null || e.date < first) first = e.date;
  return first;
}

/** Total weight×reps volume in a range (only weight_reps exercises), with a filter. */
export function volumeInRange(logs: ExerciseLog[], exercises: Map<string, Exercise>, from: DateKey, to: DateKey, filter: EntryFilter): number {
  let total = 0;
  for (const log of logs) {
    const ex = exercises.get(log.exerciseId);
    if (!ex || ex.logType !== "weight_reps") continue;
    for (const [sid, e] of Object.entries(log.entries)) {
      if (e.date < from || e.date > to || !matchesFilter(e, filter)) continue;
      total += sessionPoint(sid, e, "weight_reps").volume;
    }
  }
  return total;
}

export interface PeriodSummary {
  sessions: number;
  perWeek: number;
  volume: number;
  previousVolume: number | null;
  volumePct: number | null;
}

export function periodSummary(
  logs: ExerciseLog[],
  exercises: Map<string, Exercise>,
  range: { from: DateKey; to: DateKey },
  filter: EntryFilter,
  compare: boolean,
): PeriodSummary {
  const sessions = new Set<string>();
  for (const log of logs) {
    for (const [sid, e] of Object.entries(log.entries)) {
      if (e.date >= range.from && e.date <= range.to && matchesFilter(e, filter)) sessions.add(sid);
    }
  }
  const weeks = Math.max(1, (diffDays(range.from, range.to) + 1) / 7);
  const volume = volumeInRange(logs, exercises, range.from, range.to, filter);
  let previousVolume: number | null = null;
  let volumePct: number | null = null;
  if (compare) {
    const prev = previousRange(range);
    previousVolume = volumeInRange(logs, exercises, prev.from, prev.to, filter);
    volumePct = previousVolume > 0 ? (volume / previousVolume - 1) * 100 : null;
  }
  return { sessions: sessions.size, perWeek: sessions.size / weeks, volume, previousVolume, volumePct };
}

export interface Bucket {
  /** First day of the bucket (Monday or 1st of month). */
  start: DateKey;
  value: number;
}

/** Weekly (or monthly) weight×reps volume, including empty buckets as 0. */
export function volumeBuckets(
  logs: ExerciseLog[],
  exercises: Map<string, Exercise>,
  range: { from: DateKey; to: DateKey },
  filter: EntryFilter,
  unit: "week" | "month",
): Bucket[] {
  const keyOf = (d: DateKey) => (unit === "week" ? startOfWeek(d) : startOfMonth(d));
  const next = (d: DateKey) => (unit === "week" ? addDays(d, 7) : addMonths(d, 1));
  const map = new Map<DateKey, number>();
  for (let k = keyOf(range.from); k <= range.to; k = next(k)) map.set(k, 0);
  for (const log of logs) {
    const ex = exercises.get(log.exerciseId);
    if (!ex || ex.logType !== "weight_reps") continue;
    for (const [sid, e] of Object.entries(log.entries)) {
      if (e.date < range.from || e.date > range.to || !matchesFilter(e, filter)) continue;
      const k = keyOf(e.date);
      map.set(k, (map.get(k) ?? 0) + sessionPoint(sid, e, "weight_reps").volume);
    }
  }
  return [...map.entries()].map(([start, value]) => ({ start, value }));
}

export interface ChartPoint {
  date: DateKey;
  value: number;
  /** Ids of the sessions represented (one unless aggregated). */
  sessionIds: string[];
  record: boolean;
}

/**
 * Chart series of a metric. Past `maxPoints`, aggregates by week (or month when
 * weekly is still too many): max for strength metrics, sum for volume.
 */
export function chartSeries(
  points: SessionPoint[],
  pick: (p: SessionPoint) => number | null,
  mode: "max" | "sum",
  maxPoints: number,
  records: Set<string> = new Set(),
): { series: ChartPoint[]; aggregated: "none" | "week" | "month" } {
  const raw: ChartPoint[] = [];
  for (const p of points) {
    const v = pick(p);
    if (v !== null) raw.push({ date: p.date, value: v, sessionIds: [p.sessionId], record: records.has(p.sessionId) });
  }
  if (raw.length <= maxPoints) return { series: raw, aggregated: "none" };
  const group = (keyOf: (d: DateKey) => DateKey) => {
    const map = new Map<DateKey, ChartPoint>();
    for (const p of raw) {
      const k = keyOf(p.date);
      const cur = map.get(k);
      if (!cur) map.set(k, { ...p, date: k, sessionIds: [...p.sessionIds] });
      else {
        cur.value = mode === "max" ? Math.max(cur.value, p.value) : cur.value + p.value;
        cur.sessionIds.push(...p.sessionIds);
        cur.record = cur.record || p.record;
      }
    }
    return [...map.values()];
  };
  const weekly = group(startOfWeek);
  if (weekly.length <= maxPoints * 1.5) return { series: weekly, aggregated: "week" };
  return { series: group(startOfMonth), aggregated: "month" };
}

export interface RecentRecord {
  exerciseId: string;
  date: DateKey;
  sessionId: string;
  point: SessionPoint;
}

/** Sessions since `since` where an exercise's primary metric hit a new all-time best. */
export function recentRecords(
  pointsByExercise: Map<string, SessionPoint[]>,
  since: DateKey,
  max: number,
): RecentRecord[] {
  const out: RecentRecord[] = [];
  for (const [exerciseId, points] of pointsByExercise) {
    const recs = primaryRecordSessions(points);
    for (const p of points) if (recs.has(p.sessionId) && p.date >= since) out.push({ exerciseId, date: p.date, sessionId: p.sessionId, point: p });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out.slice(0, max);
}
