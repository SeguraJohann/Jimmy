// Live records inside a session (S10): each done set is compared with the
// records of previous sessions plus the earlier sets of the same row.

import type { ExerciseLog, LogEntry, SessionExercise } from "@/types/models";
import { pointsOf, sessionPoint, type SessionPoint } from "@/lib/metrics/points";
import { computeRecords, liveRecord, type LiveRecord } from "@/lib/metrics/records";
import { isValidDoneSet, toLogSet } from "./session";

const CURRENT = "__current__";

function previousPoints(log: ExerciseLog | undefined, row: SessionExercise, sessionId: string): SessionPoint[] {
  if (!log) return [];
  const entries: Record<string, LogEntry> = {};
  for (const [sid, e] of Object.entries(log.entries)) if (sid !== sessionId) entries[sid] = e;
  return pointsOf({ exerciseId: log.exerciseId, entries }, row.logType);
}

/** Record kind per set index (null when not a record or not done). */
export function rowRecords(row: SessionExercise, log: ExerciseLog | undefined, sessionId: string, date: string): LiveRecord[] {
  const prev = previousPoints(log, row, sessionId);
  let best = computeRecords(prev);
  const doneSoFar: LogEntry["sets"] = [];
  return row.sets.map((s) => {
    if (!isValidDoneSet(s, row.logType)) return null;
    const ls = toLogSet(s, row.logType);
    let rec = liveRecord(ls, best, row.logType);
    // A tie only counts against previous sessions, not against an earlier set today.
    if (rec === "weight" && best.maxWeight?.sessionId === CURRENT && ls.w === best.maxWeight.value && (ls.r ?? 0) <= (best.maxWeight.r ?? 0)) rec = null;
    doneSoFar.push(ls);
    const entry: LogEntry = { date, routineId: null, routineName: null, blockId: row.blockId, blockName: row.blockName, blockTypeId: row.blockTypeId, sets: [...doneSoFar] };
    best = computeRecords([...prev, sessionPoint(CURRENT, entry, row.logType)]);
    return rec;
  });
}

/** Whether any set of the row is a record. */
export function rowHasRecord(row: SessionExercise, log: ExerciseLog | undefined, sessionId: string, date: string): boolean {
  return rowRecords(row, log, sessionId, date).some((r) => r !== null);
}
