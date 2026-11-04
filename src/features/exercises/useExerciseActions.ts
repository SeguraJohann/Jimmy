import { useMemo } from "react";
import { useUid } from "@/features/auth/AuthContext";
import { useData } from "@/features/data/DataContext";
import { createExercise, deleteExercise, setExerciseArchived, updateExercise, type ExerciseInput } from "./services/exercises.service";

export function useExerciseActions() {
  const uid = useUid();
  const { routines } = useData();
  return useMemo(
    () => ({
      create: (input: ExerciseInput) => createExercise(uid, input),
      update: (id: string, input: ExerciseInput) => updateExercise(uid, id, input),
      setArchived: (id: string, archived: boolean) => setExerciseArchived(uid, id, archived),
      remove: (id: string) => deleteExercise(uid, id, routines),
    }),
    [uid, routines],
  );
}
