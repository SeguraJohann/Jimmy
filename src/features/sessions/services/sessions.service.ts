// Sessions + the derived exerciseLogs index. Every write of a DONE session
// updates the affected logs in the same batch (docs/DATA_MODEL.md).

import { deleteField, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import type { DateKey, ExerciseLog, LogEntry, Session } from "@/types/models";
import { exerciseLogDoc, exerciseLogsCol, sessionDoc, sessionsCol } from "@/lib/firebase/collections";
import { sessionConverter, sessionToDb, ts } from "@/lib/firebase/converters";
import { ChunkedBatch, commitInBackground } from "@/lib/firebase/batch";
import { reportError } from "@/lib/utils/errors";
import { newDocId } from "@/lib/utils/id";
import { logChanges, logEntryFor } from "@/lib/session/session";

// ---------- reads ----------

export function subscribeActiveSessions(uid: string, cb: (list: Session[]) => void, onError?: () => void): () => void {
  return onSnapshot(
    query(sessionsCol(uid), where("status", "==", "in_progress")),
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => {
      reportError(e);
      onError?.();
    },
  );
}

export function subscribeSessionsRange(uid: string, from: DateKey, to: DateKey, cb: (list: Session[]) => void): () => void {
  return onSnapshot(
    query(sessionsCol(uid), where("date", ">=", from), where("date", "<=", to)),
    (snap) => cb(snap.docs.map((d) => d.data())),
    reportError,
  );
}

export function subscribeRecentSessions(uid: string, n: number, cb: (list: Session[]) => void): () => void {
  return onSnapshot(
    query(sessionsCol(uid), orderBy("date", "desc"), limit(n)),
    (snap) => cb(snap.docs.map((d) => d.data())),
    reportError,
  );
}

export function subscribeSession(uid: string, id: string, cb: (s: Session | null) => void): () => void {
  return onSnapshot(
    sessionDoc(uid, id).withConverter(sessionConverter),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (e) => {
      reportError(e);
      cb(null);
    },
  );
}

export function subscribeExerciseLogs(uid: string, cb: (list: ExerciseLog[]) => void, onError?: () => void): () => void {
  return onSnapshot(
    exerciseLogsCol(uid),
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => {
      reportError(e);
      onError?.();
    },
  );
}

// ---------- writes ----------

type SessionBody = Omit<Session, "id" | "createdAt" | "updatedAt">;

function bodyOf(s: Session | SessionBody): SessionBody {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = s as Session;
  return rest;
}

function addLogChanges(batch: ChunkedBatch, uid: string, sessionId: string, changes: Map<string, LogEntry | null>): void {
  for (const [exerciseId, entry] of changes) {
    batch.set(
      exerciseLogDoc(uid, exerciseId),
      { entries: { [sessionId]: entry === null ? deleteField() : entry }, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}

/** Creates a session (in progress, or done when logging a past day directly). */
export function createSession(uid: string, data: SessionBody): string {
  const id = newDocId(uid);
  const batch = new ChunkedBatch();
  batch.set(sessionDoc(uid, id), { ...sessionToDb(data), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  if (data.status === "done") addLogChanges(batch, uid, id, logChanges(null, { ...data, id, createdAt: 0, updatedAt: 0 }));
  commitInBackground(batch);
  return id;
}

/**
 * Saves a session. `prev` is the version currently stored (needed to clean logs of
 * exercises removed from a done session).
 */
export function saveSession(uid: string, prev: Session | null, next: Session): void {
  const batch = new ChunkedBatch();
  batch.set(sessionDoc(uid, next.id), { ...sessionToDb(bodyOf(next)), createdAt: next.createdAt ? ts(next.createdAt) : serverTimestamp(), updatedAt: serverTimestamp() });
  addLogChanges(batch, uid, next.id, logChanges(prev, next));
  commitInBackground(batch);
}

export function deleteSession(uid: string, session: Session): void {
  const batch = new ChunkedBatch();
  batch.delete(sessionDoc(uid, session.id));
  addLogChanges(batch, uid, session.id, logChanges(session, null));
  commitInBackground(batch);
}

/**
 * Regenerates every exerciseLogs document from the sessions (maintenance).
 * Reads all sessions once; only for manual use from Settings.
 */
export async function rebuildExerciseLogs(uid: string): Promise<number> {
  const [sessions, logs] = await Promise.all([getDocs(query(sessionsCol(uid), where("status", "==", "done"))), getDocs(exerciseLogsCol(uid))]);
  const next = new Map<string, Record<string, LogEntry>>();
  for (const d of sessions.docs) {
    const s = d.data();
    for (const exId of new Set(s.exercises.map((r) => r.exerciseId))) {
      const e = logEntryFor(s, exId);
      if (!e) continue;
      let m = next.get(exId);
      if (!m) next.set(exId, (m = {}));
      m[s.id] = e;
    }
  }
  const batch = new ChunkedBatch();
  for (const d of logs.docs) if (!next.has(d.id)) batch.delete(exerciseLogDoc(uid, d.id));
  for (const [exId, entries] of next) batch.set(exerciseLogDoc(uid, exId), { entries, updatedAt: serverTimestamp() });
  await batch.commit();
  return sessions.size;
}
