import { z } from "zod";
import { es } from "@/i18n";

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, es.exercises.nameRequired).max(80),
  muscleGroup: z.string().trim().max(40),
  equipment: z.enum(["barbell", "dumbbell", "machine", "cable", "bodyweight", "other"]).nullable(),
  logType: z.enum(["weight_reps", "reps", "time"]),
  weightUnit: z.enum(["kg", "lb"]),
  notes: z.string().trim().max(500).nullable(),
});

export type ExerciseFormValues = z.infer<typeof exerciseSchema>;
