import { getDocs, limit, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import type { Routine, RoutineStatus } from "@/types/models";
import { routineDoc, routinesCol, sessionsCol } from "@/lib/firebase/collections";
import { ChunkedBatch, commitInBackground } from "@/lib/firebase/batch";
import { reportError } from "@/lib/utils/errors";
import { newDocId } from "@/lib/utils/id";
import type { RoutineSessionRef } from "@/lib/routine/routine";

export function subscribeRoutines(uid: string, cb: (list: Routine[]) => void, onError?: () => void): () => void {
  return onSnapshot(
    routinesCol(uid),
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => {
      reportError(e);
      onError?.();
    },
  );
}

export type RoutineDraft = Omit<Routine, "id" | "createdAt" | "updatedAt">;

function body(d: RoutineDraft) {
  return { name: d.name, description: d.description, status: d.status, blocks: d.blocks, cycle: d.cycle };
}

/** Creates or replaces a routine in a single write. Returns its id. */
export function saveRoutine(uid: string, draft: RoutineDraft, id?: string): string {
  const batch = new ChunkedBatch();
  if (id) {
    batch.update(routineDoc(uid, id), { ...body(draft), updatedAt: serverTimestamp() });
  } else {
    id = newDocId(uid);
    batch.set(routineDoc(uid, id), { ...body(draft), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  commitInBackground(batch);
  return id;
}

export function setRoutineStatus(uid: string, id: string, status: RoutineStatus): void {
  const batch = new ChunkedBatch();
  batch.update(routineDoc(uid, id), { status, updatedAt: serverTimestamp() });
  commitInBackground(batch);
}

export function deleteRoutine(uid: string, id: string): void {
  const batch = new ChunkedBatch();
  batch.delete(routineDoc(uid, id));
  commitInBackground(batch);
}

/** True when at least one session references the routine (cache first, works offline). */
export async function routineHasSessions(uid: string, id: string): Promise<boolean> {
  const snap = await getDocs(query(sessionsCol(uid), where("routineId", "==", id), limit(1)));
  return !snap.empty;
}

/** Sessions of a routine, reduced to what the day suggestion needs. */
export function subscribeRoutineSessions(uid: string, routineId: string, cb: (refs: RoutineSessionRef[]) => void): () => void {
  return onSnapshot(
    query(sessionsCol(uid), where("routineId", "==", routineId)),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const s = d.data();
          return { cycleDayId: s.cycleDayId, cycleDayNumber: s.cycleDayNumber, date: s.date, startedAt: s.startedAt };
        }),
      ),
    reportError,
  );
}
