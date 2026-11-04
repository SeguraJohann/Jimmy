// Trend classification per exercise: up / flat / down / inactive / insufficient.
// See docs/ANALYTICS.md §3.

import type { DateKey } from "@/types/models";
import { APP_CONFIG } from "@/config/app.config";
import { diffDays } from "@/lib/date/dateKey";
import { primaryRecordSessions } from "./records";
import type { SessionPoint } from "./points";

export type TrendStatus = "up" | "flat" | "down" | "inactive" | "insufficient";

export interface Trend {
  status: TrendStatus;
  /** % change per 4 weeks of the primary metric (null when not computable). */
  changePct: number | null;
  volumeStatus: "up" | "flat" | "down" | null;
  volumeChangePct: number | null;
  sessionsSinceRecord: number;
  lastDate: DateKey | null;
  sampleSize: number;
}

/** Least-squares slope of y over x. Null when x has no variance. */
export function linearSlope(pts: { x: number; y: number }[]): number | null {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

/** % change per 28 days relative to the mean. */
export function changePer4Weeks(pts: { x: number; y: number }[]): number | null {
  const slope = linearSlope(pts);
  if (slope === null) return null;
  const mean = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  if (mean === 0) return null;
  return ((slope * 28) / mean) * 100;
}

function classify(pct: number | null, threshold: number): "up" | "flat" | "down" {
  if (pct === null) return "flat";
  if (pct >= threshold) return "up";
  if (pct <= -threshold) return "down";
  return "flat";
}

export function computeTrend(points: SessionPoint[], today: DateKey): Trend {
  const cfg = APP_CONFIG.analytics;
  const valid = points.filter((p) => p.primary !== null);
  const lastDate = valid.length ? valid[valid.length - 1].date : null;

  const records = primaryRecordSessions(valid);
  let sessionsSinceRecord = 0;
  for (let i = valid.length - 1; i >= 0; i--) {
    if (records.has(valid[i].sessionId)) break;
    sessionsSinceRecord++;
  }

  const base = { lastDate, sessionsSinceRecord };
  const recent = valid.filter((p) => diffDays(p.date, today) <= cfg.trendWindowDays).slice(-cfg.trendMaxSessions);

  if (lastDate !== null && diffDays(lastDate, today) > cfg.inactiveAfterDays) {
    return { ...base, status: "inactive", changePct: null, volumeStatus: null, volumeChangePct: null, sampleSize: recent.length };
  }
  if (recent.length < cfg.trendMinSessions) {
    return { ...base, status: "insufficient", changePct: null, volumeStatus: null, volumeChangePct: null, sampleSize: recent.length };
  }

  const origin = recent[0].date;
  const strength = changePer4Weeks(recent.map((p) => ({ x: diffDays(origin, p.date), y: p.primary as number })));
  const volume = changePer4Weeks(recent.map((p) => ({ x: diffDays(origin, p.date), y: p.volume })));

  return {
    ...base,
    status: classify(strength, cfg.strengthThreshold),
    changePct: strength,
    volumeStatus: classify(volume, cfg.volumeThreshold),
    volumeChangePct: volume,
    sampleSize: recent.length,
  };
}

/** Sort order for the progress list: problems first. */
export const TREND_ORDER: Record<TrendStatus, number> = { down: 0, flat: 1, up: 2, inactive: 3, insufficient: 4 };

export interface Comparison {
  recent: { primary: number | null; volume: number; repsPerSet: number | null };
  previous: { primary: number | null; volume: number; repsPerSet: number | null };
  primaryPct: number | null;
  volumePct: number | null;
  count: number;
}

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function summarize(pts: SessionPoint[]) {
  const sets = pts.reduce((a, p) => a + p.setCount, 0);
  return {
    primary: avg(pts.map((p) => p.primary).filter((v): v is number => v !== null)),
    volume: avg(pts.map((p) => p.volume)) ?? 0,
    repsPerSet: sets ? pts.reduce((a, p) => a + p.totalReps, 0) / sets : null,
  };
}

function pct(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return (a / b - 1) * 100;
}

/** Last n sessions vs the n before them. Null when there are fewer than 2n sessions… or n+1 minimum. */
export function compareLastN(points: SessionPoint[], n = 4): Comparison | null {
  if (points.length < 2) return null;
  const k = Math.min(n, Math.floor(points.length / 2));
  const recentPts = points.slice(-k);
  const previousPts = points.slice(-2 * k, -k);
  const recent = summarize(recentPts);
  const previous = summarize(previousPts);
  return { recent, previous, primaryPct: pct(recent.primary, previous.primary), volumePct: pct(recent.volume, previous.volume), count: k };
}
