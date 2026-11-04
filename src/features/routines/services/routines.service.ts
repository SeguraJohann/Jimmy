import { getDocs, limit, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import type { Routine, RoutineStatus, Session } from "@/types/models";
import { routineDoc, routinesCol, sessionsCol } from "@/lib/firebase/collections";
import { ChunkedBatch, commitInBackground } from "@/lib/firebase/batch";
import { reportError } from "@/lib/utils/errors";
import { newDocId } from "@/lib/utils/id";
import type { RoutineSessionRef } from "@/lib/routine/routine";
import { sessionParts } from "@/lib/session/session";

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
  const [main, combined] = await Promise.all([
    getDocs(query(sessionsCol(uid), where("routineId", "==", id), limit(1))),
    getDocs(query(sessionsCol(uid), where("routineIds", "array-contains", id), limit(1))),
  ]);
  return !main.empty || !combined.empty;
}

/** Day references of one routine inside a session (main day and/or added days). */
function refsOf(s: Session, routineId: string): RoutineSessionRef[] {
  return sessionParts(s)
    .filter((p) => p.routineId === routineId)
    .map((p) => ({ cycleDayId: p.cycleDayId, cycleDayNumber: p.cycleDayNumber, date: s.date, startedAt: s.startedAt }));
}

/**
 * Sessions of a routine, reduced to what the day suggestion needs. Two single-field
 * queries merged by id: `routineId` (main routine, also older sessions) and
 * `routineIds` (routines added to combined sessions).
 */
export function subscribeRoutineSessions(uid: string, routineId: string, cb: (refs: RoutineSessionRef[]) => void): () => void {
  const main = new Map<string, Session>();
  const combined = new Map<string, Session>();
  let ready = 0;
  const emit = () => {
    if (ready < 2) return;
    const all = new Map([...main, ...combined]);
    cb([...all.values()].flatMap((s) => refsOf(s, routineId)));
  };
  const listen = (field: "routineId" | "routineIds", target: Map<string, Session>) => {
    let first = true;
    return onSnapshot(
      query(sessionsCol(uid), field === "routineId" ? where("routineId", "==", routineId) : where("routineIds", "array-contains", routineId)),
      (snap) => {
        target.clear();
        for (const d of snap.docs) target.set(d.id, d.data());
        if (first) {
          first = false;
          ready++;
        }
        emit();
      },
      reportError,
    );
  };
  const u1 = listen("routineId", main);
  const u2 = listen("routineIds", combined);
  return () => {
    u1();
    u2();
  };
}
