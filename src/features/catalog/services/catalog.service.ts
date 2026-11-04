import { onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import type { Catalog } from "@/types/models";
import { catalogDoc } from "@/lib/firebase/collections";
import { catalogFromDb } from "@/lib/firebase/converters";
import { reportError } from "@/lib/utils/errors";

/** Live catalog; defaults (from app.config) while the document does not exist. */
export function subscribeCatalog(uid: string, cb: (c: Catalog) => void, onError?: () => void): () => void {
  return onSnapshot(
    catalogDoc(uid),
    (snap) => cb(catalogFromDb(snap.exists() ? snap.data({ serverTimestamps: "estimate" }) : undefined)),
    (e) => {
      reportError(e);
      onError?.();
    },
  );
}

export function saveCatalog(uid: string, catalog: Catalog): void {
  setDoc(catalogDoc(uid), { muscleGroups: catalog.muscleGroups, blockTypes: catalog.blockTypes, updatedAt: serverTimestamp() }).catch(reportError);
}
