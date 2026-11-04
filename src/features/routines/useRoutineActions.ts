import { useMemo } from "react";
import type { Routine, RoutineStatus } from "@/types/models";
import { useUid } from "@/features/auth/AuthContext";
import { deleteRoutine, routineHasSessions, saveRoutine, setRoutineStatus, type RoutineDraft } from "./services/routines.service";
import { duplicateRoutine } from "@/lib/routine/routine";

export function useRoutineActions() {
  const uid = useUid();
  return useMemo(
    () => ({
      save: (draft: RoutineDraft, id?: string) => saveRoutine(uid, draft, id),
      setStatus: (id: string, status: RoutineStatus) => setRoutineStatus(uid, id, status),
      remove: (id: string) => deleteRoutine(uid, id),
      hasSessions: (id: string) => routineHasSessions(uid, id),
      duplicate: (routine: Routine, name: string) => saveRoutine(uid, duplicateRoutine(routine, name)),
    }),
    [uid],
  );
}
