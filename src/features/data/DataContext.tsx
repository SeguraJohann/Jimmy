// App-wide live data: catalog, exercises, routines, exercise logs and the
// session in progress. All small collections (one doc per exercise/routine).

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Catalog, Exercise, ExerciseLog, Routine, Session } from "@/types/models";
import { useUid } from "@/features/auth/AuthContext";
import { subscribeCatalog } from "@/features/catalog/services/catalog.service";
import { subscribeExercises } from "@/features/exercises/services/exercises.service";
import { subscribeRoutines } from "@/features/routines/services/routines.service";
import { subscribeActiveSessions, subscribeExerciseLogs } from "@/features/sessions/services/sessions.service";
import { catalogFromDb } from "@/lib/firebase/converters";

interface DataValue {
  catalog: Catalog;
  exercises: Exercise[];
  exercisesById: Map<string, Exercise>;
  routines: Routine[];
  routinesById: Map<string, Routine>;
  logs: ExerciseLog[];
  logsById: Map<string, ExerciseLog>;
  /** The session in progress (at most one; the newest if several). */
  activeSession: Session | null;
  loading: boolean;
  error: boolean;
}

const DataContext = createContext<DataValue | null>(null);

type Key = "catalog" | "exercises" | "routines" | "logs" | "active";

export function DataProvider({ children }: { children: ReactNode }) {
  const uid = useUid();
  const [catalog, setCatalog] = useState<Catalog>(() => catalogFromDb(undefined));
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [active, setActive] = useState<Session[]>([]);
  const [ready, setReady] = useState<Set<Key>>(new Set());
  const [error, setError] = useState(false);

  useEffect(() => {
    const mark = (k: Key) => setReady((s) => (s.has(k) ? s : new Set(s).add(k)));
    const fail = () => setError(true);
    const unsubs = [
      subscribeCatalog(uid, (c) => (setCatalog(c), mark("catalog")), fail),
      subscribeExercises(uid, (l) => (setExercises(l), mark("exercises")), fail),
      subscribeRoutines(uid, (l) => (setRoutines(l), mark("routines")), fail),
      subscribeExerciseLogs(uid, (l) => (setLogs(l), mark("logs")), fail),
      subscribeActiveSessions(uid, (l) => (setActive(l), mark("active")), fail),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const value = useMemo<DataValue>(() => {
    const sortedEx = [...exercises].sort((a, b) => a.name.localeCompare(b.name, "es"));
    const sortedRt = [...routines].sort((a, b) => b.updatedAt - a.updatedAt);
    const activeSession = active.length ? [...active].sort((a, b) => b.startedAt - a.startedAt)[0] : null;
    return {
      catalog,
      exercises: sortedEx,
      exercisesById: new Map(exercises.map((e) => [e.id, e])),
      routines: sortedRt,
      routinesById: new Map(routines.map((r) => [r.id, r])),
      logs,
      logsById: new Map(logs.map((l) => [l.exerciseId, l])),
      activeSession,
      loading: ready.size < 5 && !error,
      error,
    };
  }, [catalog, exercises, routines, logs, active, ready, error]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
