// Domain types. Exact mirror of docs/DATA_MODEL.md.
// Timestamps are epoch millis in the domain; converters translate to Firestore.

/** "YYYY-MM-DD", local calendar day. */
export type DateKey = string;
/** Epoch milliseconds. */
export type Millis = number;
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ColorKey = "amber" | "blue" | "coral" | "violet" | "green" | "teal" | "pink" | "slate";

export type LogType = "weight_reps" | "reps" | "time";
export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "other";

// ---------- catalog ----------

export interface BlockType {
  id: string;
  name: string;
  color: ColorKey;
}

export interface Catalog {
  muscleGroups: string[];
  blockTypes: BlockType[];
}

// ---------- exercises ----------

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: Equipment | null;
  logType: LogType;
  notes: string | null;
  archived: boolean;
  createdAt: Millis;
  updatedAt: Millis;
}

// ---------- routines ----------

export interface BlockExercise {
  id: string;
  exerciseId: string;
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeight: number | null;
  note: string | null;
}

export interface Block {
  name: string;
  typeId: string;
  position: number;
  exercises: BlockExercise[];
}

export interface CycleDay {
  id: string;
  /** null = automatic name from its blocks. */
  name: string | null;
  blockIds: string[];
}

export type RoutineStatus = "active" | "archived";

export interface Routine {
  id: string;
  name: string;
  description: string | null;
  status: RoutineStatus;
  blocks: Record<string, Block>;
  cycle: CycleDay[];
  createdAt: Millis;
  updatedAt: Millis;
}

// ---------- sessions ----------

export interface SetEntry {
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  done: boolean;
}

export interface Target {
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  weight: number | null;
  note: string | null;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  logType: LogType;
  blockId: string | null;
  blockName: string | null;
  blockTypeId: string | null;
  blockTypeName: string | null;
  blockColor: ColorKey | null;
  target: Target | null;
  skipped: boolean;
  notes: string | null;
  sets: SetEntry[];
}

export type SessionStatus = "in_progress" | "done";

/**
 * A routine day added to a session that already has one (combined session,
 * e.g. back + legs on the same visit). Name copies, like the main fields.
 */
export interface SessionPart {
  routineId: string;
  routineName: string;
  cycleDayId: string;
  cycleDayNumber: number;
  dayName: string;
  /** Blocks of that day: tells which routine each row came from. */
  blockIds: string[];
}

export interface Session {
  id: string;
  date: DateKey;
  status: SessionStatus;
  routineId: string | null;
  routineName: string | null;
  cycleDayId: string | null;
  cycleDayNumber: number | null;
  dayName: string | null;
  /** Other routine days done in the same session (empty for a normal session). */
  extraParts: SessionPart[];
  startedAt: Millis;
  endedAt: Millis | null;
  notes: string | null;
  exercises: SessionExercise[];
  createdAt: Millis;
  updatedAt: Millis;
}

// ---------- derived index ----------

/** A done, valid set in compact form. */
export interface LogSet {
  w: number | null;
  r: number | null;
  s: number | null;
}

export interface LogEntry {
  date: DateKey;
  routineId: string | null;
  routineName: string | null;
  blockId: string | null;
  blockName: string | null;
  blockTypeId: string | null;
  sets: LogSet[];
}

export interface ExerciseLog {
  exerciseId: string;
  entries: Record<string, LogEntry>;
}
