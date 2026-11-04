import { onSnapshot, serverTimestamp } from "firebase/firestore";
import type { Equipment, Exercise, LogType, Routine, WeightUnit } from "@/types/models";
import { exerciseDoc, exerciseLogDoc, exercisesCol, routineDoc } from "@/lib/firebase/collections";
import { ChunkedBatch, commitInBackground } from "@/lib/firebase/batch";
import { reportError } from "@/lib/utils/errors";
import { newDocId } from "@/lib/utils/id";

export function subscribeExercises(uid: string, cb: (list: Exercise[]) => void, onError?: () => void): () => void {
  return onSnapshot(
    exercisesCol(uid),
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => {
      reportError(e);
      onError?.();
    },
  );
}

export interface ExerciseInput {
  name: string;
  muscleGroup: string;
  equipment: Equipment | null;
  logType: LogType;
  weightUnit: WeightUnit;
  notes: string | null;
}

export function createExercise(uid: string, input: ExerciseInput): string {
  const id = newDocId(uid);
  const batch = new ChunkedBatch();
  batch.set(exerciseDoc(uid, id), { ...input, archived: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  commitInBackground(batch);
  return id;
}

export function updateExercise(uid: string, id: string, input: ExerciseInput): void {
  const batch = new ChunkedBatch();
  batch.update(exerciseDoc(uid, id), { ...input, updatedAt: serverTimestamp() });
  commitInBackground(batch);
}

/** Changes only the display unit (quick kg / lb switch while logging). */
export function setExerciseUnit(uid: string, id: string, weightUnit: WeightUnit): void {
  const batch = new ChunkedBatch();
  batch.update(exerciseDoc(uid, id), { weightUnit, updatedAt: serverTimestamp() });
  commitInBackground(batch);
}

export function setExerciseArchived(uid: string, id: string, archived: boolean): void {
  const batch = new ChunkedBatch();
  batch.update(exerciseDoc(uid, id), { archived, updatedAt: serverTimestamp() });
  commitInBackground(batch);
}

/**
 * Deletes an exercise WITHOUT history, its (empty) log and its rows in the routines
 * that use it — all in one batch.
 */
export function deleteExercise(uid: string, id: string, routines: Routine[]): void {
  const batch = new ChunkedBatch();
  batch.delete(exerciseDoc(uid, id));
  batch.delete(exerciseLogDoc(uid, id));
  for (const r of routines) {
    let touched = false;
    const blocks: Routine["blocks"] = {};
    for (const [bid, b] of Object.entries(r.blocks)) {
      const exercises = b.exercises.filter((e) => e.exerciseId !== id);
      if (exercises.length !== b.exercises.length) touched = true;
      blocks[bid] = { ...b, exercises };
    }
    if (touched) batch.update(routineDoc(uid, r.id), { blocks, updatedAt: serverTimestamp() });
  }
  commitInBackground(batch);
}
