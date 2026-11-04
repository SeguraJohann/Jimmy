import { useMemo } from "react";
import type { DateKey, Routine, Session, SessionExercise } from "@/types/models";
import { useUid } from "@/features/auth/AuthContext";
import { useData } from "@/features/data/DataContext";
import { createSession, deleteSession, saveSession } from "./services/sessions.service";
import { addRoutineDay, buildDayRows, finalizeRows, rowFromExercise, sessionHeader, sessionParts, type AddDayResult } from "@/lib/session/session";
import { moveInArray, orderedBlockIds } from "@/lib/routine/routine";

/** Session writes for components (Component → hook → service). */
export function useSessionActions() {
  const uid = useUid();
  const { catalog, exercisesById, logsById, routinesById } = useData();

  return useMemo(() => {
    const save = (prev: Session, next: Session) => saveSession(uid, prev, { ...next, updatedAt: Date.now() });

    const update = (prev: Session, mutate: (s: Session) => Session) => save(prev, mutate(prev));

    const updateRow = (prev: Session, rowId: string, mutate: (r: SessionExercise) => SessionExercise) =>
      update(prev, (s) => ({ ...s, exercises: s.exercises.map((r) => (r.id === rowId ? mutate(r) : r)) }));

    /** Builds a row for an exercise; uses its block in the session's routine when it has one (keeps metrics by type). */
    const rowFor = (exerciseId: string, routinesInSession: Routine[]): SessionExercise | null => {
      const ex = exercisesById.get(exerciseId);
      if (!ex) return null;
      for (const routine of routinesInSession) {
        for (const bid of orderedBlockIds(routine)) {
          const block = routine.blocks[bid];
          const be = block.exercises.find((e) => e.exerciseId === exerciseId);
          if (!be) continue;
          const type = catalog.blockTypes.find((t) => t.id === block.typeId) ?? null;
          return rowFromExercise(ex, {
            block: { id: bid, name: block.name, typeId: block.typeId, typeName: type?.name ?? null, color: type?.color ?? null },
            target: { sets: be.targetSets, repsMin: be.targetRepsMin, repsMax: be.targetRepsMax, weight: be.targetWeight, note: be.note },
            log: logsById.get(exerciseId),
          });
        }
      }
      return rowFromExercise(ex, { log: logsById.get(exerciseId) });
    };

    return {
      startFromRoutine(routine: Routine, dayIndex: number, date: DateKey): string {
        const now = Date.now();
        return createSession(uid, {
          date,
          status: "in_progress",
          ...sessionHeader(routine, dayIndex),
          startedAt: now,
          endedAt: null,
          notes: null,
          exercises: buildDayRows(routine, dayIndex, catalog, exercisesById, logsById),
        });
      },

      startFree(date: DateKey): string {
        return createSession(uid, {
          date,
          status: "in_progress",
          ...sessionHeader(null, null),
          startedAt: Date.now(),
          endedAt: null,
          notes: null,
          exercises: [],
        });
      },

      update,
      updateRow,

      addExercise(prev: Session, exerciseId: string): string | null {
        const inSession = [...new Set(sessionParts(prev).map((p) => p.routineId))].flatMap((id) => routinesById.get(id) ?? []);
        const row = rowFor(exerciseId, inSession);
        if (!row) return null;
        update(prev, (s) => ({ ...s, exercises: [...s.exercises, row] }));
        return row.id;
      },

      /** Combined session: adds another routine day to this session. */
      addRoutineDay(prev: Session, routine: Routine, dayIndex: number): AddDayResult {
        const res = addRoutineDay(prev, routine, dayIndex, buildDayRows(routine, dayIndex, catalog, exercisesById, logsById));
        if (!("error" in res)) save(prev, res.session);
        return res;
      },

      moveRow(prev: Session, rowId: string, delta: number) {
        update(prev, (s) => ({ ...s, exercises: moveInArray(s.exercises, s.exercises.findIndex((r) => r.id === rowId), delta) }));
      },

      removeRow(prev: Session, rowId: string) {
        update(prev, (s) => ({ ...s, exercises: s.exercises.filter((r) => r.id !== rowId) }));
      },

      finish(prev: Session) {
        save(prev, { ...prev, status: "done", endedAt: Date.now(), exercises: finalizeRows(prev.exercises) });
      },

      /** Re-applies the finishing rules after editing a done session. */
      saveEdited(prev: Session) {
        save(prev, { ...prev, exercises: finalizeRows(prev.exercises) });
      },

      changeDate(prev: Session, date: DateKey) {
        update(prev, (s) => ({ ...s, date }));
      },

      remove(session: Session) {
        deleteSession(uid, session);
      },
    };
  }, [uid, catalog, exercisesById, logsById, routinesById]);
}
