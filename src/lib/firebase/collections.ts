// Typed Firestore references. ONLY services import from lib/firebase.

import { collection, doc } from "firebase/firestore";
import { db } from "@/config/firebase";
import { exerciseConverter, exerciseLogConverter, routineConverter, sessionConverter } from "./converters";

export const userDoc = (uid: string) => doc(db, "users", uid);
export const catalogDoc = (uid: string) => doc(db, "users", uid, "meta", "catalog");

export const exercisesCol = (uid: string) => collection(db, "users", uid, "exercises").withConverter(exerciseConverter);
export const exercisesRawCol = (uid: string) => collection(db, "users", uid, "exercises");
export const exerciseDoc = (uid: string, id: string) => doc(db, "users", uid, "exercises", id);

export const routinesCol = (uid: string) => collection(db, "users", uid, "routines").withConverter(routineConverter);
export const routinesRawCol = (uid: string) => collection(db, "users", uid, "routines");
export const routineDoc = (uid: string, id: string) => doc(db, "users", uid, "routines", id);

export const sessionsCol = (uid: string) => collection(db, "users", uid, "sessions").withConverter(sessionConverter);
export const sessionsRawCol = (uid: string) => collection(db, "users", uid, "sessions");
export const sessionDoc = (uid: string, id: string) => doc(db, "users", uid, "sessions", id);

export const exerciseLogsCol = (uid: string) => collection(db, "users", uid, "exerciseLogs").withConverter(exerciseLogConverter);
export const exerciseLogDoc = (uid: string, exerciseId: string) => doc(db, "users", uid, "exerciseLogs", exerciseId);

export { db };
