// Data hooks: the only bridge between components and services.

import { useEffect, useMemo, useState } from "react";
import type { DateKey, Exercise, Session } from "@/types/models";
import { useUid } from "@/features/auth/AuthContext";
import { useData } from "./DataContext";
import { useToday } from "./ClockContext";
import { subscribeRecentSessions, subscribeSession, subscribeSessionsRange } from "@/features/sessions/services/sessions.service";
import { subscribeRoutineSessions } from "@/features/routines/services/routines.service";
import type { RoutineSessionRef } from "@/lib/routine/routine";
import { pointsOf, type EntryFilter, type SessionPoint } from "@/lib/metrics/points";
import { computeTrend, type Trend } from "@/lib/metrics/trend";
import { computeRecords, type Records } from "@/lib/metrics/records";

interface Loadable<T> {
  data: T;
  loading: boolean;
}

function useSubscription<T>(key: string | null, initial: T, subscribe: (cb: (v: T) => void) => () => void): Loadable<T> {
  const [state, setState] = useState<{ key: string | null; data: T; loading: boolean }>({ key, data: initial, loading: key !== null });
  useEffect(() => {
    if (key === null) return;
    setState((s) => (s.key === key ? s : { key, data: initial, loading: true }));
    return subscribe((data) => setState({ key, data, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data: state.key === key ? state.data : initial, loading: state.key === key ? state.loading : key !== null };
}

const NO_SESSIONS: Session[] = [];
const NO_REFS: RoutineSessionRef[] = [];

/** Sessions with date in [from, to] (one query per month in History). */
export function useSessionsRange(from: DateKey, to: DateKey): Loadable<Session[]> {
  const uid = useUid();
  return useSubscription(`${uid}|${from}|${to}`, NO_SESSIONS, (cb) => subscribeSessionsRange(uid, from, to, cb));
}

export function useRecentSessions(n: number): Loadable<Session[]> {
  const uid = useUid();
  return useSubscription(`${uid}|recent|${n}`, NO_SESSIONS, (cb) => subscribeRecentSessions(uid, n, cb));
}

export function useSession(id: string | null): Loadable<Session | null> {
  const uid = useUid();
  return useSubscription<Session | null>(id ? `${uid}|${id}` : null, null, (cb) => subscribeSession(uid, id!, cb));
}

export function useRoutineSessions(routineId: string | null): Loadable<RoutineSessionRef[]> {
  const uid = useUid();
  return useSubscription(routineId ? `${uid}|rs|${routineId}` : null, NO_REFS, (cb) => subscribeRoutineSessions(uid, routineId!, cb));
}

// ---------- analytics (from exerciseLogs, no reads) ----------

export interface ExerciseAnalytics {
  exercise: Exercise;
  points: SessionPoint[];
  trend: Trend;
  records: Records;
}

/** Points, trend and records of one exercise under a filter. */
export function useExerciseAnalytics(exerciseId: string | undefined, filter: EntryFilter = { kind: "all" }): ExerciseAnalytics | null {
  const { exercisesById, logsById } = useData();
  const today = useToday();
  const exercise = exerciseId ? exercisesById.get(exerciseId) : undefined;
  const log = exerciseId ? logsById.get(exerciseId) : undefined;
  const filterKey = JSON.stringify(filter);
  return useMemo(() => {
    if (!exercise) return null;
    const points = pointsOf(log, exercise.logType, filter);
    return { exercise, points, trend: computeTrend(points, today), records: computeRecords(points) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise, log, filterKey, today]);
}

/** Analytics of every exercise (all sessions), keyed by exercise id. */
export function useAllAnalytics(): Map<string, ExerciseAnalytics> {
  const { exercises, logsById } = useData();
  const today = useToday();
  return useMemo(() => {
    const out = new Map<string, ExerciseAnalytics>();
    for (const exercise of exercises) {
      const points = pointsOf(logsById.get(exercise.id), exercise.logType);
      out.set(exercise.id, { exercise, points, trend: computeTrend(points, today), records: computeRecords(points) });
    }
    return out;
  }, [exercises, logsById, today]);
}
