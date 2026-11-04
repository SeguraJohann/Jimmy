// Firestore ⇄ domain converters. Timestamps become epoch millis in the domain.
// Readers are defensive: missing fields get safe defaults.

import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type {
  Block,
  BlockExercise,
  BlockType,
  Catalog,
  CycleDay,
  Exercise,
  ExerciseLog,
  LogEntry,
  LogSet,
  Routine,
  Session,
  SessionExercise,
  SetEntry,
  Target,
} from "@/types/models";
import { APP_CONFIG } from "@/config/app.config";

export function toMillis(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "seconds" in v) {
    const s = v as { seconds: number; nanoseconds?: number };
    return s.seconds * 1000 + Math.floor((s.nanoseconds ?? 0) / 1e6);
  }
  return null;
}

export function ts(ms: number): Timestamp {
  return Timestamp.fromMillis(ms);
}

export function tsOrNull(ms: number | null): Timestamp | null {
  return ms === null ? null : Timestamp.fromMillis(ms);
}

function readData(snap: QueryDocumentSnapshot, options?: SnapshotOptions): DocumentData {
  return snap.data({ ...options, serverTimestamps: "estimate" });
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// ---------- catalog ----------

export function catalogFromDb(d: DocumentData | undefined): Catalog {
  if (!d) return { muscleGroups: [...APP_CONFIG.defaults.muscleGroups], blockTypes: APP_CONFIG.defaults.blockTypes.map((t) => ({ ...t })) };
  const blockTypes: BlockType[] = arr(d.blockTypes)
    .map((t) => t as DocumentData)
    .filter((t) => t && typeof t.id === "string")
    .map((t) => ({ id: t.id, name: str(t.name) ?? "", color: t.color ?? "slate" }));
  return {
    muscleGroups: arr(d.muscleGroups).filter((g): g is string => typeof g === "string"),
    blockTypes,
  };
}

// ---------- exercises ----------

export const exerciseConverter: FirestoreDataConverter<Exercise> = {
  toFirestore: (e) => {
    const { id: _id, ...rest } = e as Exercise;
    return { ...rest, createdAt: ts(rest.createdAt), updatedAt: ts(rest.updatedAt) };
  },
  fromFirestore: (snap, options) => {
    const d = readData(snap, options);
    const createdAt = toMillis(d.createdAt) ?? 0;
    return {
      id: snap.id,
      name: str(d.name) ?? "",
      muscleGroup: str(d.muscleGroup) ?? "",
      equipment: d.equipment ?? null,
      logType: d.logType ?? "weight_reps",
      notes: str(d.notes),
      archived: !!d.archived,
      createdAt,
      updatedAt: toMillis(d.updatedAt) ?? createdAt,
    };
  },
};

// ---------- routines ----------

function blockExerciseFromDb(d: DocumentData): BlockExercise {
  return {
    id: str(d.id) ?? "",
    exerciseId: str(d.exerciseId) ?? "",
    targetSets: num(d.targetSets),
    targetRepsMin: num(d.targetRepsMin),
    targetRepsMax: num(d.targetRepsMax),
    targetWeight: num(d.targetWeight),
    note: str(d.note),
  };
}

export function routineFromDb(id: string, d: DocumentData): Routine {
  const blocks: Record<string, Block> = {};
  for (const [bid, raw] of Object.entries((d.blocks ?? {}) as Record<string, DocumentData>)) {
    if (!raw) continue;
    blocks[bid] = {
      name: str(raw.name) ?? "",
      typeId: str(raw.typeId) ?? "",
      position: num(raw.position) ?? 0,
      exercises: arr(raw.exercises).map((e) => blockExerciseFromDb(e as DocumentData)),
    };
  }
  const cycle: CycleDay[] = arr(d.cycle).map((x) => {
    const c = x as DocumentData;
    return { id: str(c.id) ?? "", name: str(c.name), blockIds: arr(c.blockIds).filter((b): b is string => typeof b === "string") };
  });
  const createdAt = toMillis(d.createdAt) ?? 0;
  return {
    id,
    name: str(d.name) ?? "",
    description: str(d.description),
    status: d.status === "archived" ? "archived" : "active",
    blocks,
    cycle,
    createdAt,
    updatedAt: toMillis(d.updatedAt) ?? createdAt,
  };
}

export const routineConverter: FirestoreDataConverter<Routine> = {
  toFirestore: (r) => {
    const { id: _id, ...rest } = r as Routine;
    return { ...rest, createdAt: ts(rest.createdAt), updatedAt: ts(rest.updatedAt) };
  },
  fromFirestore: (snap, options) => routineFromDb(snap.id, readData(snap, options)),
};

// ---------- sessions ----------

function setFromDb(d: DocumentData): SetEntry {
  return { weight: num(d.weight), reps: num(d.reps), seconds: num(d.seconds), done: !!d.done };
}

function targetFromDb(d: DocumentData | null | undefined): Target | null {
  if (!d) return null;
  return { sets: num(d.sets), repsMin: num(d.repsMin), repsMax: num(d.repsMax), weight: num(d.weight), note: str(d.note) };
}

function sessionExerciseFromDb(d: DocumentData): SessionExercise {
  return {
    id: str(d.id) ?? "",
    exerciseId: str(d.exerciseId) ?? "",
    exerciseName: str(d.exerciseName) ?? "",
    logType: d.logType ?? "weight_reps",
    blockId: str(d.blockId),
    blockName: str(d.blockName),
    blockTypeId: str(d.blockTypeId),
    blockTypeName: str(d.blockTypeName),
    blockColor: d.blockColor ?? null,
    target: targetFromDb(d.target),
    skipped: !!d.skipped,
    notes: str(d.notes),
    sets: arr(d.sets).map((s) => setFromDb(s as DocumentData)),
  };
}

export function sessionFromDb(id: string, d: DocumentData): Session {
  const createdAt = toMillis(d.createdAt) ?? 0;
  return {
    id,
    date: str(d.date) ?? "1970-01-01",
    status: d.status === "in_progress" ? "in_progress" : "done",
    routineId: str(d.routineId),
    routineName: str(d.routineName),
    cycleDayId: str(d.cycleDayId),
    cycleDayNumber: num(d.cycleDayNumber),
    dayName: str(d.dayName),
    extraParts: arr(d.extraParts).flatMap((x) => {
      const e = x as DocumentData;
      const routineId = str(e.routineId);
      const cycleDayId = str(e.cycleDayId);
      if (!routineId || !cycleDayId) return [];
      return [{ routineId, routineName: str(e.routineName) ?? "", cycleDayId, cycleDayNumber: num(e.cycleDayNumber) ?? 0, dayName: str(e.dayName) ?? "", blockIds: arr(e.blockIds).filter((b): b is string => typeof b === "string") }];
    }),
    startedAt: toMillis(d.startedAt) ?? createdAt,
    endedAt: toMillis(d.endedAt),
    notes: str(d.notes),
    exercises: arr(d.exercises).map((e) => sessionExerciseFromDb(e as DocumentData)),
    createdAt,
    updatedAt: toMillis(d.updatedAt) ?? createdAt,
  };
}

/** Session body for Firestore (without id and audit timestamps). */
export function sessionToDb(s: Omit<Session, "id" | "createdAt" | "updatedAt">): DocumentData {
  // routineIds: every routine in the session, for array-contains queries (no composite index).
  const routineIds = [...new Set([s.routineId, ...s.extraParts.map((p) => p.routineId)].filter((x): x is string => !!x))];
  return { ...s, routineIds, startedAt: ts(s.startedAt), endedAt: tsOrNull(s.endedAt) };
}

export const sessionConverter: FirestoreDataConverter<Session> = {
  toFirestore: (s) => {
    const { id: _id, ...rest } = s as Session;
    return { ...sessionToDb(rest), createdAt: ts(rest.createdAt), updatedAt: ts(rest.updatedAt) };
  },
  fromFirestore: (snap, options) => sessionFromDb(snap.id, readData(snap, options)),
};

// ---------- exercise logs ----------

function logSetFromDb(d: DocumentData): LogSet {
  return { w: num(d.w), r: num(d.r), s: num(d.s) };
}

export function logEntryFromDb(d: DocumentData): LogEntry {
  return {
    date: str(d.date) ?? "1970-01-01",
    routineId: str(d.routineId),
    routineName: str(d.routineName),
    blockId: str(d.blockId),
    blockName: str(d.blockName),
    blockTypeId: str(d.blockTypeId),
    sets: arr(d.sets).map((s) => logSetFromDb(s as DocumentData)),
  };
}

export const exerciseLogConverter: FirestoreDataConverter<ExerciseLog> = {
  toFirestore: (l) => {
    const { exerciseId: _id, ...rest } = l as ExerciseLog;
    return rest;
  },
  fromFirestore: (snap, options) => {
    const d = readData(snap, options);
    const entries: Record<string, LogEntry> = {};
    for (const [sid, raw] of Object.entries((d.entries ?? {}) as Record<string, DocumentData>)) {
      if (raw) entries[sid] = logEntryFromDb(raw);
    }
    return { exerciseId: snap.id, entries };
  },
};
