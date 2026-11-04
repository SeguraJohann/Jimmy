import { doc } from "firebase/firestore";
import { exercisesRawCol } from "@/lib/firebase/collections";

/** Generates a Firestore-style id locally (works offline). */
export function newDocId(uid: string): string {
  return doc(exercisesRawCol(uid)).id;
}
