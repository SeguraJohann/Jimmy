// Per-session metrics of one exercise, derived from its exerciseLog entries.
// Pure: no Firebase, no React. See docs/ANALYTICS.md §1.

import type { DateKey, ExerciseLog, LogEntry, LogSet, LogType } from "@/types/models";
import { APP_CONFIG } from "@/config/app.config";

/** Epley estimated 1RM; null when reps are out of the 1..12 range or weight is missing. */
export function e1rm(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null || weight <= 0 || reps < 1 || reps > APP_CONFIG.maxRepsFor1RM) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function setVolume(s: LogSet): number {
  return s.w !== null && s.r !== null && s.w > 0 ? s.w * s.r : 0;
}

export interface SessionPoint {
  sessionId: string;
  date: DateKey;
  entry: LogEntry;
  /** Main metric for trend and records (e1RM / max reps / max seconds). */
  primary: number | null;
  /** True when `primary` fell back to the top weight (no set within 1..12 reps). */
  primaryIsFallback: boolean;
  topWeight: number | null;
  /** Reps done with the top weight. */
  topWeightReps: number | null;
  e1rm: number | null;
  /** Σ w×r (weight_reps), Σ reps (reps), Σ seconds (time). */
  volume: number;
  totalReps: number;
  bestReps: number | null;
  bestSeconds: number | null;
  setCount: number;
}

export function sessionPoint(sessionId: string, entry: LogEntry, logType: LogType): SessionPoint {
  let topWeight: number | null = null;
  let topWeightReps: number | null = null;
  let best1rm: number | null = null;
  let volume = 0;
  let totalReps = 0;
  let bestReps: number | null = null;
  let bestSeconds: number | null = null;

  for (const s of entry.sets) {
    if (s.r !== null) {
      totalReps += s.r;
      bestReps = bestReps === null ? s.r : Math.max(bestReps, s.r);
    }
    if (s.s !== null) bestSeconds = bestSeconds === null ? s.s : Math.max(bestSeconds, s.s);
    if (s.w !== null && s.w > 0) {
      if (topWeight === null || s.w > topWeight || (s.w === topWeight && (s.r ?? 0) > (topWeightReps ?? 0))) {
        topWeight = s.w;
        topWeightReps = s.r;
      }
    }
    const est = e1rm(s.w, s.r);
    if (est !== null) best1rm = best1rm === null ? est : Math.max(best1rm, est);
    if (logType === "weight_reps") volume += setVolume(s);
    else if (logType === "reps") volume += s.r ?? 0;
    else volume += s.s ?? 0;
  }

  let primary: number | null;
  let primaryIsFallback = false;
  if (logType === "weight_reps") {
    primary = best1rm;
    if (primary === null && topWeight !== null) {
      primary = topWeight;
      primaryIsFallback = true;
    }
  } else if (logType === "reps") primary = bestReps;
  else primary = bestSeconds;

  return {
    sessionId,
    date: entry.date,
    entry,
    primary,
    primaryIsFallback,
    topWeight,
    topWeightReps,
    e1rm: best1rm,
    volume,
    totalReps,
    bestReps,
    bestSeconds,
    setCount: entry.sets.length,
  };
}

export type EntryFilter =
  | { kind: "all" }
  | { kind: "type"; id: string }
  | { kind: "block"; id: string }
  | { kind: "routine"; id: string };

export function matchesFilter(entry: LogEntry, filter: EntryFilter): boolean {
  switch (filter.kind) {
    case "all":
      return true;
    case "type":
      return entry.blockTypeId === filter.id;
    case "block":
      return entry.blockId === filter.id;
    case "routine":
      return entry.routineId === filter.id;
  }
}

/** Points sorted by date ascending (ties by session id for stability). */
export function pointsOf(log: ExerciseLog | undefined, logType: LogType, filter: EntryFilter = { kind: "all" }): SessionPoint[] {
  if (!log) return [];
  const out: SessionPoint[] = [];
  for (const [sid, entry] of Object.entries(log.entries)) {
    if (!matchesFilter(entry, filter) || entry.sets.length === 0) continue;
    out.push(sessionPoint(sid, entry, logType));
  }
  out.sort((a, b) => (a.date === b.date ? (a.sessionId < b.sessionId ? -1 : 1) : a.date < b.date ? -1 : 1));
  return out;
}

/** Most recent entry, preferring the same block when given (S6). Excludes a session id. */
export function lastEntry(
  log: ExerciseLog | undefined,
  opts: { blockId?: string | null; excludeSessionId?: string; beforeOrOn?: DateKey } = {},
): { sessionId: string; entry: LogEntry } | null {
  if (!log) return null;
  let best: { sessionId: string; entry: LogEntry } | null = null;
  let bestSameBlock: { sessionId: string; entry: LogEntry } | null = null;
  for (const [sid, entry] of Object.entries(log.entries)) {
    if (sid === opts.excludeSessionId || entry.sets.length === 0) continue;
    if (opts.beforeOrOn && entry.date > opts.beforeOrOn) continue;
    if (!best || entry.date > best.entry.date) best = { sessionId: sid, entry };
    if (opts.blockId && entry.blockId === opts.blockId && (!bestSameBlock || entry.date > bestSameBlock.entry.date)) {
      bestSameBlock = { sessionId: sid, entry };
    }
  }
  return bestSameBlock ?? best;
}

/** Simple moving average (window n, partial at the start). */
export function movingAverage(values: (number | null)[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    const win = values.slice(Math.max(0, i - n + 1), i + 1).filter((v): v is number => v !== null);
    out.push(win.length ? win.reduce((a, b) => a + b, 0) / win.length : null);
  }
  return out;
}
