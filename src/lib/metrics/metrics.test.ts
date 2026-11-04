import { describe, expect, it } from "vitest";
import type { ExerciseLog, LogEntry, LogSet } from "@/types/models";
import { e1rm, lastEntry, movingAverage, pointsOf, sessionPoint } from "./points";
import { computeRecords, liveRecord, primaryRecordSessions } from "./records";
import { changePer4Weeks, compareLastN, computeTrend, linearSlope } from "./trend";
import { chartSeries, periodRange, previousRange, volumeBuckets } from "./aggregate";
import { addDays } from "@/lib/date/dateKey";

const set = (w: number | null, r: number | null, s: number | null = null): LogSet => ({ w, r, s });
const entry = (date: string, sets: LogSet[], extra: Partial<LogEntry> = {}): LogEntry => ({
  date,
  routineId: "r1",
  routineName: "PPL",
  blockId: "b1",
  blockName: "Pull 2",
  blockTypeId: "pull",
  sets,
  ...extra,
});
const log = (entries: Record<string, LogEntry>, exerciseId = "e1"): ExerciseLog => ({ exerciseId, entries });

describe("e1rm (Epley)", () => {
  it("uses weight × (1 + reps/30)", () => {
    expect(e1rm(60, 10)).toBeCloseTo(80);
    expect(e1rm(100, 1)).toBe(100);
  });
  it("ignores sets above 12 reps or without weight", () => {
    expect(e1rm(40, 13)).toBeNull();
    expect(e1rm(null, 10)).toBeNull();
    expect(e1rm(0, 10)).toBeNull();
  });
});

describe("sessionPoint", () => {
  it("computes top weight, volume and best e1RM", () => {
    const p = sessionPoint("s1", entry("2026-10-01", [set(60, 10), set(60, 10), set(65, 8)]), "weight_reps");
    expect(p.topWeight).toBe(65);
    expect(p.topWeightReps).toBe(8);
    expect(p.volume).toBe(60 * 10 * 2 + 65 * 8);
    expect(p.e1rm).toBeCloseTo(82.33, 1);
    expect(p.primary).toBe(p.e1rm);
  });
  it("falls back to top weight when no set is within 1..12 reps", () => {
    const p = sessionPoint("s1", entry("2026-10-01", [set(20, 20)]), "weight_reps");
    expect(p.e1rm).toBeNull();
    expect(p.primary).toBe(20);
    expect(p.primaryIsFallback).toBe(true);
  });
  it("reps type uses max reps (scenario 19)", () => {
    const p = sessionPoint("s1", entry("2026-10-01", [set(null, 8), set(null, 10), set(null, 7)]), "reps");
    expect(p.primary).toBe(10);
    expect(p.volume).toBe(25);
  });
  it("time type uses max seconds (scenario 20)", () => {
    const p = sessionPoint("s1", entry("2026-10-01", [set(null, null, 60), set(null, null, 45)]), "time");
    expect(p.primary).toBe(60);
  });
});

describe("pointsOf + filters", () => {
  const l = log({
    a: entry("2026-10-10", [set(50, 10)]),
    b: entry("2026-10-01", [set(45, 10)], { blockId: "b9", blockTypeId: "full", routineId: "r2" }),
    c: entry("2026-10-20", [set(55, 10)]),
  });
  it("sorts by date", () => {
    expect(pointsOf(l, "weight_reps").map((p) => p.sessionId)).toEqual(["b", "a", "c"]);
  });
  it("filters by block (scenario 17), type and routine", () => {
    expect(pointsOf(l, "weight_reps", { kind: "block", id: "b1" }).map((p) => p.sessionId)).toEqual(["a", "c"]);
    expect(pointsOf(l, "weight_reps", { kind: "type", id: "full" }).map((p) => p.sessionId)).toEqual(["b"]);
    expect(pointsOf(l, "weight_reps", { kind: "routine", id: "r1" })).toHaveLength(2);
  });
});

describe("lastEntry (S6, scenario 9)", () => {
  const l = log({
    a: entry("2026-10-10", [set(50, 10)], { blockId: "b1" }),
    b: entry("2026-10-20", [set(40, 12)], { blockId: "b2" }),
  });
  it("prefers the same block", () => {
    expect(lastEntry(l, { blockId: "b1" })?.sessionId).toBe("a");
  });
  it("falls back to the most recent", () => {
    expect(lastEntry(l, { blockId: "zz" })?.sessionId).toBe("b");
    expect(lastEntry(l)?.sessionId).toBe("b");
  });
  it("excludes the current session", () => {
    expect(lastEntry(l, { excludeSessionId: "b" })?.sessionId).toBe("a");
  });
});

describe("records", () => {
  const pts = pointsOf(
    log({
      a: entry("2026-10-01", [set(50, 12), set(55, 10)]),
      b: entry("2026-10-08", [set(55, 10), set(57.5, 10)]),
      c: entry("2026-10-15", [set(57.5, 8)]),
    }),
    "weight_reps",
  );
  const rec = computeRecords(pts);
  it("finds max weight with its best reps", () => {
    expect(rec.maxWeight?.value).toBe(57.5);
    expect(rec.maxWeight?.r).toBe(10);
  });
  it("builds reps by weight, heaviest first", () => {
    expect(rec.repsByWeight.map((x) => [x.w, x.r])).toEqual([
      [57.5, 10],
      [55, 10],
      [50, 12],
    ]);
  });
  it("detects a live weight record (scenario 10)", () => {
    expect(liveRecord(set(60, 5), rec, "weight_reps")).toBe("weight");
    expect(liveRecord(set(57.5, 10), rec, "weight_reps")).toBe("weight"); // ties count
    expect(liveRecord(set(55, 11), rec, "weight_reps")).toBe("reps"); // more reps than ever with ≥ 55 kg
    expect(liveRecord(set(50, 12), rec, "weight_reps")).toBeNull(); // ties the reps at 50 kg
    expect(liveRecord(set(40, 5), rec, "weight_reps")).toBeNull();
  });
  it("detects an e1RM record below the max weight", () => {
    expect(liveRecord(set(55, 12), rec, "weight_reps")).toBe("e1rm");
  });
  it("no records without history", () => {
    expect(liveRecord(set(100, 5), computeRecords([]), "weight_reps")).toBeNull();
  });
  it("primary record sessions skip the baseline", () => {
    expect([...primaryRecordSessions(pts)]).toEqual(["b"]);
  });
});

describe("trend", () => {
  const today = "2026-11-03";
  const build = (values: number[], gapDays = 7) => {
    const entries: Record<string, LogEntry> = {};
    values.forEach((w, i) => (entries[`s${String(i).padStart(2, "0")}`] = entry(addDays(today, -(values.length - 1 - i) * gapDays), [set(w, 10)])));
    return pointsOf(log(entries), "weight_reps");
  };
  it("slope basics", () => {
    expect(linearSlope([{ x: 0, y: 1 }, { x: 1, y: 3 }])).toBe(2);
    expect(linearSlope([{ x: 1, y: 1 }, { x: 1, y: 3 }])).toBeNull();
    expect(changePer4Weeks([{ x: 0, y: 100 }, { x: 28, y: 110 }])).toBeCloseTo((10 / 105) * 100);
  });
  it("progressing", () => {
    expect(computeTrend(build([50, 52.5, 55, 55, 57.5, 60]), today).status).toBe("up");
  });
  it("stalled", () => {
    expect(computeTrend(build([60, 60, 60, 60, 60]), today).status).toBe("flat");
  });
  it("declining strength and volume", () => {
    const t = computeTrend(build([60, 57.5, 55, 52.5, 50]), today);
    expect(t.status).toBe("down");
    expect(t.volumeStatus).toBe("down");
  });
  it("insufficient data", () => {
    expect(computeTrend(build([60, 62.5]), today).status).toBe("insufficient");
  });
  it("inactive after weeks without training", () => {
    const entries = { a: entry("2026-08-01", [set(50, 10)]), b: entry("2026-08-08", [set(52.5, 10)]), c: entry("2026-08-15", [set(55, 10)]) };
    expect(computeTrend(pointsOf(log(entries), "weight_reps"), today).status).toBe("inactive");
  });
  it("only uses the last 6 sessions", () => {
    // Old big gains, recent plateau → flat.
    expect(computeTrend(build([30, 35, 40, 45, 60, 60, 60, 60, 60, 60]), today).status).toBe("flat");
  });
  it("counts sessions since the last record", () => {
    expect(computeTrend(build([50, 55, 55, 55]), today).sessionsSinceRecord).toBe(2);
  });
  it("compares last 4 vs previous 4", () => {
    const c = compareLastN(build([50, 50, 50, 50, 55, 55, 55, 55]))!;
    expect(c.count).toBe(4);
    expect(c.volumePct).toBeCloseTo(10);
    expect(compareLastN(build([50]))).toBeNull();
  });
});

describe("aggregation", () => {
  it("period ranges", () => {
    expect(periodRange("4w", "2026-11-03", null)).toEqual({ from: "2026-10-07", to: "2026-11-03" });
    expect(previousRange({ from: "2026-10-07", to: "2026-11-03" })).toEqual({ from: "2026-09-09", to: "2026-10-06" });
  });
  it("weekly buckets include empty weeks as zero", () => {
    const logs = [log({ a: entry("2026-10-05", [set(100, 10)]), b: entry("2026-10-20", [set(100, 5)]) })];
    const ex = new Map([["e1", { id: "e1", logType: "weight_reps" } as never]]);
    const b = volumeBuckets(logs, ex, { from: "2026-10-05", to: "2026-10-25" }, { kind: "all" }, "week");
    expect(b.map((x) => x.value)).toEqual([1000, 0, 500]);
  });
  it("chart series aggregates past the limit", () => {
    const entries: Record<string, LogEntry> = {};
    for (let i = 0; i < 100; i++) entries[`s${String(i).padStart(3, "0")}`] = entry(addDays("2025-01-01", i * 2), [set(50 + i, 5)]);
    const pts = pointsOf(log(entries), "weight_reps");
    const res = chartSeries(pts, (p) => p.topWeight, "max", 60);
    expect(res.aggregated).toBe("week");
    expect(res.series.length).toBeLessThan(100);
    expect(res.series[res.series.length - 1].value).toBe(149);
  });
  it("moving average", () => {
    expect(movingAverage([1, 2, 3, null, 5], 3)).toEqual([1, 1.5, 2, 2.5, 4]);
  });
});
