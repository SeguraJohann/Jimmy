// Records per exercise and live record detection. See docs/ANALYTICS.md §2.

import type { DateKey, LogSet, LogType } from "@/types/models";
import { e1rm, type SessionPoint } from "./points";

export interface RecordMark {
  value: number;
  /** Weight and reps of the set that made it (when relevant). */
  w: number | null;
  r: number | null;
  date: DateKey;
  sessionId: string;
}

export interface Records {
  maxWeight: RecordMark | null;
  best1RM: RecordMark | null;
  bestVolume: RecordMark | null;
  bestReps: RecordMark | null;
  bestSeconds: RecordMark | null;
  /** Max reps achieved at each weight, heaviest first. */
  repsByWeight: { w: number; r: number; date: DateKey }[];
}

export const EMPTY_RECORDS: Records = {
  maxWeight: null,
  best1RM: null,
  bestVolume: null,
  bestReps: null,
  bestSeconds: null,
  repsByWeight: [],
};

function better(cur: RecordMark | null, value: number): boolean {
  return cur === null || value > cur.value;
}

export function computeRecords(points: SessionPoint[]): Records {
  const rec: Records = { ...EMPTY_RECORDS, repsByWeight: [] };
  const byWeight = new Map<number, { r: number; date: DateKey }>();
  for (const p of points) {
    for (const s of p.entry.sets) {
      if (s.w !== null && s.w > 0) {
        if (rec.maxWeight === null || s.w > rec.maxWeight.value || (s.w === rec.maxWeight.value && (s.r ?? 0) > (rec.maxWeight.r ?? 0))) {
          rec.maxWeight = { value: s.w, w: s.w, r: s.r, date: p.date, sessionId: p.sessionId };
        }
        if (s.r !== null) {
          const cur = byWeight.get(s.w);
          if (!cur || s.r > cur.r) byWeight.set(s.w, { r: s.r, date: p.date });
        }
      }
      const est = e1rm(s.w, s.r);
      if (est !== null && better(rec.best1RM, est)) rec.best1RM = { value: est, w: s.w, r: s.r, date: p.date, sessionId: p.sessionId };
      if (s.r !== null && better(rec.bestReps, s.r)) rec.bestReps = { value: s.r, w: s.w, r: s.r, date: p.date, sessionId: p.sessionId };
      if (s.s !== null && better(rec.bestSeconds, s.s)) rec.bestSeconds = { value: s.s, w: null, r: null, date: p.date, sessionId: p.sessionId };
    }
    if (p.volume > 0 && better(rec.bestVolume, p.volume)) rec.bestVolume = { value: p.volume, w: null, r: null, date: p.date, sessionId: p.sessionId };
  }
  rec.repsByWeight = [...byWeight.entries()].map(([w, v]) => ({ w, r: v.r, date: v.date })).sort((a, b) => b.w - a.w);
  return rec;
}

export type LiveRecord = "weight" | "e1rm" | "reps" | "seconds" | null;

/**
 * Whether a set beats (or ties, for weight) the previous records (S10).
 * `previous` must exclude the current session. Returns the most relevant one.
 */
export function liveRecord(set: LogSet, previous: Records, logType: LogType): LiveRecord {
  if (logType === "time") {
    if (set.s !== null && set.s > 0 && previous.bestSeconds !== null && set.s > previous.bestSeconds.value) return "seconds";
    return null;
  }
  if (logType === "reps") {
    if (set.r !== null && set.r > 0 && previous.bestReps !== null && set.r > previous.bestReps.value) return "reps";
    return null;
  }
  if (set.w === null || set.w <= 0 || set.r === null || set.r <= 0) return null;
  // No history yet: nothing to beat.
  if (previous.maxWeight === null) return null;
  if (set.w > previous.maxWeight.value || (set.w === previous.maxWeight.value && set.r >= (previous.maxWeight.r ?? 0))) return "weight";
  const est = e1rm(set.w, set.r);
  if (est !== null && previous.best1RM !== null && est > previous.best1RM.value + 1e-9) return "e1rm";
  // More reps than ever with this weight or heavier.
  const heavierOrEqual = previous.repsByWeight.filter((x) => x.w >= set.w!);
  if (heavierOrEqual.length > 0 && set.r > Math.max(...heavierOrEqual.map((x) => x.r))) return "reps";
  return null;
}

/** Session ids in which the primary metric set a new all-time best (chronological). */
export function primaryRecordSessions(points: SessionPoint[]): Set<string> {
  const out = new Set<string>();
  let best: number | null = null;
  for (const p of points) {
    if (p.primary === null) continue;
    if (best === null) {
      best = p.primary;
      continue; // the first session is a baseline, not a record
    }
    if (p.primary > best + 1e-9) {
      best = p.primary;
      out.add(p.sessionId);
    }
  }
  return out;
}
