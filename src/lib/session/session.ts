// Session logic: building from a routine day, prefill, status, summary,
// finishing and the derived exerciseLogs entries. Pure and tested.

import type {
  Catalog,
  Exercise,
  ExerciseLog,
  LogEntry,
  LogSet,
  LogType,
  Routine,
  Session,
  SessionExercise,
  SetEntry,
  Target,
} from "@/types/models";
import { shortId } from "@/lib/utils/shortId";
import { roundTo } from "@/lib/utils/number";
import { lastEntry } from "@/lib/metrics/points";
import { dayName } from "@/lib/routine/routine";

export function emptySet(weight: number | null = null): SetEntry {
  return { weight, reps: null, seconds: null, done: false };
}

/** A done set with a real value for its log type. */
export function isValidDoneSet(s: SetEntry, logType: LogType): boolean {
  if (!s.done) return false;
  if (logType === "time") return s.seconds !== null && s.seconds > 0;
  return s.reps !== null && s.reps > 0;
}

/** A set with data typed in (counts as done when finishing, C11). */
export function hasValue(s: SetEntry, logType: LogType): boolean {
  if (logType === "time") return s.seconds !== null && s.seconds > 0;
  return s.reps !== null && s.reps > 0;
}

export function toLogSet(s: SetEntry, logType: LogType): LogSet {
  return {
    w: logType === "weight_reps" ? s.weight : null,
    r: logType === "time" ? null : s.reps,
    s: logType === "time" ? s.seconds : null,
  };
}

/**
 * Pending sets for a new session row (C10): max(target sets, last time sets, 1),
 * weight copied from the matching set of last time (or the target weight).
 */
export function prefillSets(logType: LogType, target: Target | null, last: LogEntry | null): SetEntry[] {
  const lastSets = last?.sets ?? [];
  const count = Math.max(target?.sets ?? 0, lastSets.length, 1);
  const out: SetEntry[] = [];
  for (let i = 0; i < count; i++) {
    let w: number | null = null;
    if (logType === "weight_reps") {
      w = lastSets[i]?.w ?? lastSets[lastSets.length - 1]?.w ?? target?.weight ?? null;
    }
    out.push(emptySet(w));
  }
  return out;
}

/** Reps (or seconds) suggested for a set: last time's matching set, else the target. */
export function suggestedValue(row: SessionExercise, index: number, last: LogEntry | null): number | null {
  const lastSets = last?.sets ?? [];
  const ls = lastSets[index] ?? lastSets[lastSets.length - 1];
  if (row.logType === "time") return ls?.s ?? null;
  return ls?.r ?? row.target?.repsMax ?? row.target?.repsMin ?? null;
}

/** ＋ Serie: copies the weight of the previous set (S7). */
export function addSet(row: SessionExercise): SessionExercise {
  const prev = row.sets[row.sets.length - 1];
  return { ...row, sets: [...row.sets, emptySet(prev?.weight ?? row.target?.weight ?? null)] };
}

/** Adjusts the weight of the current (first not done, else last) set. */
export function stepWeight(row: SessionExercise, delta: number): SessionExercise {
  if (row.sets.length === 0) return row;
  let i = row.sets.findIndex((s) => !s.done);
  if (i < 0) i = row.sets.length - 1;
  const cur = row.sets[i].weight ?? 0;
  const next = Math.max(0, roundTo(cur + delta, Math.abs(delta) || 1));
  return { ...row, sets: row.sets.map((s, k) => (k === i ? { ...s, weight: next } : s)) };
}

export function currentSetIndex(row: SessionExercise): number {
  const i = row.sets.findIndex((s) => !s.done);
  return i < 0 ? row.sets.length - 1 : i;
}

export function rowFromExercise(
  exercise: Pick<Exercise, "id" | "name" | "logType">,
  opts: {
    block?: { id: string; name: string; typeId: string; typeName: string | null; color: SessionExercise["blockColor"] } | null;
    target?: Target | null;
    log?: ExerciseLog;
  } = {},
): SessionExercise {
  const last = lastEntry(opts.log, { blockId: opts.block?.id ?? null })?.entry ?? null;
  const target = opts.target ?? null;
  return {
    id: shortId(),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    logType: exercise.logType,
    blockId: opts.block?.id ?? null,
    blockName: opts.block?.name ?? null,
    blockTypeId: opts.block?.typeId ?? null,
    blockTypeName: opts.block?.typeName ?? null,
    blockColor: opts.block?.color ?? null,
    target,
    skipped: false,
    notes: null,
    sets: prefillSets(exercise.logType, target, last),
  };
}

/** Rows for the blocks of a cycle day, grouped by block in order (S3). Missing exercises are skipped. */
export function buildDayRows(
  routine: Routine,
  dayIndex: number,
  catalog: Catalog,
  exercises: Map<string, Exercise>,
  logs: Map<string, ExerciseLog>,
): SessionExercise[] {
  const day = routine.cycle[dayIndex];
  if (!day) return [];
  const rows: SessionExercise[] = [];
  for (const blockId of day.blockIds) {
    const block = routine.blocks[blockId];
    if (!block) continue;
    const type = catalog.blockTypes.find((t) => t.id === block.typeId) ?? null;
    for (const be of block.exercises) {
      const ex = exercises.get(be.exerciseId);
      if (!ex) continue;
      const target: Target | null =
        be.targetSets !== null || be.targetRepsMin !== null || be.targetRepsMax !== null || be.targetWeight !== null || be.note
          ? { sets: be.targetSets, repsMin: be.targetRepsMin, repsMax: be.targetRepsMax, weight: be.targetWeight, note: be.note }
          : null;
      rows.push(
        rowFromExercise(ex, {
          block: { id: blockId, name: block.name, typeId: block.typeId, typeName: type?.name ?? null, color: type?.color ?? null },
          target,
          log: logs.get(ex.id),
        }),
      );
    }
  }
  return rows;
}

export function sessionHeader(routine: Routine | null, dayIndex: number | null) {
  if (!routine || dayIndex === null || !routine.cycle[dayIndex]) {
    return { routineId: null, routineName: null, cycleDayId: null, cycleDayNumber: null, dayName: null };
  }
  const day = routine.cycle[dayIndex];
  return { routineId: routine.id, routineName: routine.name, cycleDayId: day.id, cycleDayNumber: dayIndex + 1, dayName: dayName(routine, day) };
}

// ---------- status & summary ----------

export type RowStatus = "pending" | "in_progress" | "done" | "skipped";

export function rowStatus(row: SessionExercise): RowStatus {
  if (row.skipped) return "skipped";
  const done = row.sets.filter((s) => s.done).length;
  if (done === 0) return "pending";
  const target = row.target?.sets ?? null;
  if (row.sets.some((s) => !s.done) || (target !== null && done < target)) return "in_progress";
  return "done";
}

export function rowVolume(row: SessionExercise): number {
  if (row.logType !== "weight_reps") return 0;
  return row.sets.reduce((a, s) => a + (s.done && s.weight && s.reps ? s.weight * s.reps : 0), 0);
}

export interface SessionSummary {
  exercisesTotal: number;
  exercisesDone: number;
  sets: number;
  volume: number;
}

export function sessionSummary(session: Pick<Session, "exercises">): SessionSummary {
  const rows = session.exercises.filter((r) => !r.skipped);
  return {
    exercisesTotal: rows.length,
    exercisesDone: rows.filter((r) => r.sets.some((s) => isValidDoneSet(s, r.logType))).length,
    sets: rows.reduce((a, r) => a + r.sets.filter((s) => isValidDoneSet(s, r.logType)).length, 0),
    volume: rows.reduce((a, r) => a + rowVolume(r), 0),
  };
}

/** Next row to log after `rowId` (pending or in progress, wrapping), or null. */
export function nextRowId(session: Pick<Session, "exercises">, rowId: string): string | null {
  const rows = session.exercises;
  const i = rows.findIndex((r) => r.id === rowId);
  for (let k = 1; k <= rows.length; k++) {
    const r = rows[(i + k) % rows.length];
    if (r.id === rowId) continue;
    const st = rowStatus(r);
    if (st === "pending" || st === "in_progress") return r.id;
  }
  return null;
}

/** Sets with data but no ✓ and rows without any done set (for the finish summary). */
export function finishPreview(session: Pick<Session, "exercises">): { unchecked: number; empty: number; notDone: string[] } {
  let unchecked = 0;
  let empty = 0;
  const notDone: string[] = [];
  for (const r of session.exercises) {
    for (const s of r.sets) {
      if (!s.done && hasValue(s, r.logType)) unchecked++;
      if (!hasValue(s, r.logType)) empty++;
    }
    if (!r.skipped && !r.sets.some((s) => hasValue(s, r.logType))) notDone.push(r.exerciseName);
  }
  return { unchecked, empty, notDone };
}

/** C11: sets with values become done; empty sets are dropped. */
export function finalizeRows(rows: SessionExercise[]): SessionExercise[] {
  return rows.map((r) => ({
    ...r,
    sets: r.sets.filter((s) => hasValue(s, r.logType)).map((s) => ({ ...s, done: true })),
  }));
}

export function hasAnyValue(rows: SessionExercise[]): boolean {
  return rows.some((r) => r.sets.some((s) => hasValue(s, r.logType)));
}

// ---------- derived index ----------

/** Log entry of one exercise in a session (rows of the same exercise concatenated). */
export function logEntryFor(session: Session, exerciseId: string): LogEntry | null {
  const rows = session.exercises.filter((r) => r.exerciseId === exerciseId);
  if (rows.length === 0) return null;
  const sets: LogSet[] = [];
  for (const r of rows) for (const s of r.sets) if (isValidDoneSet(s, r.logType)) sets.push(toLogSet(s, r.logType));
  if (sets.length === 0) return null;
  const first = rows.find((r) => r.blockId) ?? rows[0];
  return {
    date: session.date,
    routineId: session.routineId,
    routineName: session.routineName,
    blockId: first.blockId,
    blockName: first.blockName,
    blockTypeId: first.blockTypeId,
    sets,
  };
}

/**
 * Log changes for a session write: exerciseId → entry (set) or null (delete).
 * In-progress sessions are not indexed.
 */
export function logChanges(prev: Session | null, next: Session | null): Map<string, LogEntry | null> {
  const ids = new Set<string>();
  if (prev?.status === "done") for (const r of prev.exercises) ids.add(r.exerciseId);
  if (next?.status === "done") for (const r of next.exercises) ids.add(r.exerciseId);
  const out = new Map<string, LogEntry | null>();
  for (const id of ids) out.set(id, next?.status === "done" ? logEntryFor(next, id) : null);
  return out;
}

export function sessionDurationMin(s: Pick<Session, "startedAt" | "endedAt">, now: number = Date.now()): number {
  return Math.max(0, Math.round(((s.endedAt ?? now) - s.startedAt) / 60_000));
}
