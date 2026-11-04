import { describe, expect, it } from "vitest";
import type { Catalog, Exercise, ExerciseLog, Routine, Session, SessionExercise } from "@/types/models";
import { sessionTitle } from "./format";
import { fromUnit } from "@/lib/utils/units";
const fromLb = (lb: number) => fromUnit(lb, "lb");
import {
  addRoutineDay,
  addSet,
  buildDayRows,
  finalizeRows,
  finishPreview,
  logChanges,
  logEntryFor,
  nextRowId,
  prefillSets,
  rowStatus,
  sessionSummary,
  stepWeight,
  suggestedValue,
} from "./session";

const ex = (id: string, logType: Exercise["logType"] = "weight_reps"): Exercise => ({
  id,
  name: id.toUpperCase(),
  muscleGroup: "Espalda",
  equipment: null,
  logType,
  weightUnit: "kg",
  notes: null,
  archived: false,
  createdAt: 0,
  updatedAt: 0,
});

const catalog: Catalog = { muscleGroups: [], blockTypes: [{ id: "pull", name: "Pull", color: "amber" }] };

const routine: Routine = {
  id: "r1",
  name: "PPL",
  description: null,
  status: "active",
  blocks: {
    b1: {
      name: "Pull 2",
      typeId: "pull",
      position: 1,
      exercises: [
        { id: "x1", exerciseId: "remo", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetWeight: null, note: null },
        { id: "x2", exerciseId: "jalon", targetSets: null, targetRepsMin: null, targetRepsMax: null, targetWeight: null, note: null },
      ],
    },
  },
  cycle: [{ id: "d1", name: null, blockIds: ["b1"] }],
  createdAt: 0,
  updatedAt: 0,
};

const logs = new Map<string, ExerciseLog>([
  [
    "jalon",
    {
      exerciseId: "jalon",
      entries: {
        old: {
          date: "2026-10-31",
          routineId: "r1",
          routineName: "PPL",
          blockId: "b1",
          blockName: "Pull 2",
          blockTypeId: "pull",
          sets: [
            { w: 50, r: 12, s: null },
            { w: 55, r: 10, s: null },
            { w: 55, r: 9, s: null },
          ],
        },
      },
    },
  ],
]);

const row = (over: Partial<SessionExercise> = {}): SessionExercise => ({
  id: "row",
  exerciseId: "e",
  exerciseName: "E",
  logType: "weight_reps",
  blockId: null,
  blockName: null,
  blockTypeId: null,
  blockTypeName: null,
  blockColor: null,
  target: null,
  skipped: false,
  notes: null,
  sets: [],
  ...over,
});

const done = (weight: number, reps: number) => ({ weight, reps, seconds: null, done: true });
const open = (weight: number | null, reps: number | null = null) => ({ weight, reps, seconds: null, done: false });

const session = (over: Partial<Session> = {}): Session => ({
  id: "s1",
  date: "2026-11-03",
  status: "done",
  routineId: "r1",
  routineName: "PPL",
  cycleDayId: "d1",
  cycleDayNumber: 1,
  dayName: "Pull 2",
  extraParts: [],
  startedAt: 0,
  endedAt: 3_600_000,
  notes: null,
  exercises: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe("building a session from a day (S3, S6)", () => {
  const rows = buildDayRows(
    routine,
    0,
    catalog,
    new Map([
      ["remo", ex("remo")],
      ["jalon", ex("jalon")],
    ]),
    logs,
  );
  it("loads the exercises in block order with copies", () => {
    expect(rows.map((r) => r.exerciseId)).toEqual(["remo", "jalon"]);
    expect(rows[0].blockName).toBe("Pull 2");
    expect(rows[0].blockTypeName).toBe("Pull");
    expect(rows[0].blockColor).toBe("amber");
  });
  it("creates target sets without history", () => {
    expect(rows[0].sets).toHaveLength(3);
    expect(rows[0].sets[0].weight).toBeNull();
  });
  it("prefills weights from last time (scenario 9)", () => {
    expect(rows[1].sets.map((s) => s.weight)).toEqual([50, 55, 55]);
    expect(rows[1].sets.every((s) => s.reps === null && !s.done)).toBe(true);
  });
  it("skips exercises that no longer exist", () => {
    expect(buildDayRows(routine, 0, catalog, new Map([["remo", ex("remo")]]), logs)).toHaveLength(1);
  });
});

describe("sets", () => {
  it("prefill count = max(target, last, 1)", () => {
    expect(prefillSets("weight_reps", null, null)).toHaveLength(1);
    expect(prefillSets("reps", { sets: 4, repsMin: null, repsMax: null, weight: null, note: null }, null)).toHaveLength(4);
  });
  it("suggested reps come from last time, else the target", () => {
    const last = logs.get("jalon")!.entries.old;
    expect(suggestedValue(row(), 1, last)).toBe(10);
    expect(suggestedValue(row(), 7, last)).toBe(9);
    expect(suggestedValue(row({ target: { sets: 3, repsMin: 10, repsMax: 12, weight: null, note: null } }), 0, null)).toBe(12);
  });
  it("adding a set copies the previous weight; the step adjusts the current set", () => {
    const r = addSet(row({ sets: [done(60, 10)] }));
    expect(r.sets[1].weight).toBe(60);
    expect(stepWeight(r, 2.5).sets[1].weight).toBe(62.5);
    expect(stepWeight(row({ sets: [done(60, 10)] }), -2.5).sets[0].weight).toBe(57.5);
  });
});

describe("status and summary", () => {
  it("row status", () => {
    expect(rowStatus(row({ sets: [open(1)] }))).toBe("pending");
    expect(rowStatus(row({ sets: [done(1, 5), open(1)] }))).toBe("in_progress");
    expect(rowStatus(row({ sets: [done(1, 5)] }))).toBe("done");
    expect(rowStatus(row({ skipped: true }))).toBe("skipped");
  });
  it("summary counts valid done sets and volume", () => {
    const s = sessionSummary({ exercises: [row({ sets: [done(60, 10), open(60)] })] });
    expect(s).toEqual({ exercisesTotal: 1, exercisesDone: 1, sets: 1, volume: 600 });
  });
  it("next row skips done ones and wraps", () => {
    const a = row({ id: "a", sets: [done(1, 1)] });
    const b = row({ id: "b", sets: [open(1)] });
    expect(nextRowId({ exercises: [b, a] }, "a")).toBe("b");
    expect(nextRowId({ exercises: [a] }, "a")).toBeNull();
  });
});

describe("finishing (C11, scenario 12)", () => {
  const rows = [row({ id: "a", exerciseName: "A", sets: [done(60, 10), open(60, 8), open(60)] }), row({ id: "b", exerciseName: "B", sets: [open(40)] })];
  it("previews unchecked sets and exercises not done", () => {
    expect(finishPreview({ exercises: rows })).toEqual({ unchecked: 1, empty: 2, notDone: ["B"] });
  });
  it("marks typed sets as done and drops empty ones", () => {
    const f = finalizeRows(rows);
    expect(f[0].sets).toHaveLength(2);
    expect(f[0].sets.every((s) => s.done)).toBe(true);
    expect(f[1].sets).toHaveLength(0);
  });
});

describe("derived index", () => {
  const s = session({
    exercises: [
      row({ id: "a", exerciseId: "e1", blockId: "b1", blockName: "Pull 2", blockTypeId: "pull", sets: [done(60, 10)] }),
      row({ id: "b", exerciseId: "e1", sets: [done(50, 12)] }),
      row({ id: "c", exerciseId: "e2", sets: [open(50)] }),
    ],
  });
  it("concatenates rows of the same exercise", () => {
    const e = logEntryFor(s, "e1")!;
    expect(e.sets).toHaveLength(2);
    expect(e.blockTypeId).toBe("pull");
  });
  it("no entry without valid sets", () => {
    expect(logEntryFor(s, "e2")).toBeNull();
  });
  it("diff sets, updates and deletes (scenario 14)", () => {
    const edited = session({ exercises: [s.exercises[0]] });
    const ch = logChanges(s, edited);
    expect(ch.get("e1")?.sets).toHaveLength(1);
    expect(ch.has("e2")).toBe(true);
    expect(ch.get("e2")).toBeNull();
    expect([...logChanges(s, null).values()].every((v) => v === null)).toBe(true);
  });
  it("in-progress sessions are not indexed", () => {
    expect(logChanges(null, session({ status: "in_progress", exercises: s.exercises })).size).toBe(0);
  });
});

describe("live records in a row (S10, scenario 10)", async () => {
  const { rowRecords } = await import("./records");
  const history: ExerciseLog = {
    exerciseId: "e",
    entries: { old: { date: "2026-10-01", routineId: null, routineName: null, blockId: null, blockName: null, blockTypeId: null, sets: [{ w: 60, r: 10, s: null }] } },
  };
  it("flags a heavier set once and ignores ties with today's own sets", () => {
    const r = row({ sets: [done(62.5, 8), done(62.5, 8), done(60, 12), open(60)] });
    expect(rowRecords(r, history, "today", "2026-11-03")).toEqual(["weight", null, "e1rm", null]);
  });
  it("ties with a previous session count", () => {
    expect(rowRecords(row({ sets: [done(60, 10)] }), history, "today", "2026-11-03")).toEqual(["weight"]);
  });
  it("ignores the session's own stored entry", () => {
    const withSelf: ExerciseLog = { ...history, entries: { ...history.entries, today: { ...history.entries.old, sets: [{ w: 100, r: 5, s: null }] } } };
    expect(rowRecords(row({ sets: [done(70, 5)] }), withSelf, "today", "2026-11-03")).toEqual(["weight"]);
  });
});

describe("combined sessions (two routines in one visit)", () => {
  const legs: Routine = {
    id: "legs",
    name: "Pierna básica",
    description: null,
    status: "active",
    blocks: { bl: { name: "Pierna", typeId: "leg", position: 1, exercises: [] } },
    cycle: [{ id: "ld1", name: null, blockIds: ["bl"] }],
    createdAt: 0,
    updatedAt: 0,
  };
  const base = session({ status: "in_progress", exercises: [row({ id: "a", exerciseId: "e1", blockId: "b1", sets: [done(60, 10)] })] });
  const legRows = [row({ id: "x", exerciseId: "sq", exerciseName: "Sentadilla", blockId: "bl" }), row({ id: "y", exerciseId: "e1", exerciseName: "E1", blockId: "bl" })];

  it("appends the day as an extra part and skips exercises already there", () => {
    const res = addRoutineDay(base, legs, 0, legRows);
    if ("error" in res) throw new Error(res.error);
    expect(res.added).toBe(1);
    expect(res.skipped).toEqual(["E1"]);
    expect(res.session.routineId).toBe("r1");
    expect(res.session.extraParts).toEqual([{ routineId: "legs", routineName: "Pierna básica", cycleDayId: "ld1", cycleDayNumber: 1, dayName: "Pierna", blockIds: ["bl"] }]);
    expect(sessionTitle(res.session)).toBe("PPL · Día 1 · Pull 2 + Pierna básica · Día 1 · Pierna");
  });
  it("refuses the same day twice", () => {
    const res = addRoutineDay(base, legs, 0, legRows);
    if ("error" in res) throw new Error(res.error);
    expect(addRoutineDay(res.session, legs, 0, legRows)).toEqual({ error: "sameDay" });
  });
  it("a free session takes the day as its main routine", () => {
    const free = session({ routineId: null, routineName: null, cycleDayId: null, cycleDayNumber: null, dayName: null, exercises: [] });
    const res = addRoutineDay(free, legs, 0, legRows);
    if ("error" in res) throw new Error(res.error);
    expect(res.session.routineId).toBe("legs");
    expect(res.session.extraParts).toEqual([]);
  });
  it("log entries keep the routine each exercise came from", () => {
    const res = addRoutineDay(base, legs, 0, legRows);
    if ("error" in res) throw new Error(res.error);
    const s = { ...res.session, status: "done" as const, exercises: res.session.exercises.map((r) => ({ ...r, sets: [done(100, 5)] })) };
    expect(logEntryFor(s, "sq")?.routineId).toBe("legs");
    expect(logEntryFor(s, "e1")?.routineId).toBe("r1");
  });
});

describe("weights in pounds", () => {
  it("steps 5 lb and stores kg", async () => {
    const { toUnit } = await import("@/lib/utils/units");
    const { formatLogSet, setsLine } = await import("./format");
    const r = row({ sets: [open(fromLb(50))] });
    const up = stepWeight(r, 5, "lb");
    expect(toUnit(up.sets[0].weight!, "lb")).toBeCloseTo(55, 4);
    expect(formatLogSet({ w: fromLb(110), r: 10, s: null }, "weight_reps", "lb")).toBe("110 lb × 10");
    expect(setsLine([done(fromLb(100), 10), done(fromLb(110), 8)], "weight_reps", "lb")).toBe("100×10 · 110×8 lb");
  });
});
