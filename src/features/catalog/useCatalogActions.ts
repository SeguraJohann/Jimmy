import { useMemo } from "react";
import type { BlockType, Catalog, ColorKey } from "@/types/models";
import { useUid } from "@/features/auth/AuthContext";
import { useData } from "@/features/data/DataContext";
import { saveCatalog } from "./services/catalog.service";
import { rebuildExerciseLogs } from "@/features/sessions/services/sessions.service";
import { shortId } from "@/lib/utils/shortId";

export function useCatalogActions() {
  const uid = useUid();
  const { catalog } = useData();
  return useMemo(() => {
    const save = (next: Catalog) => saveCatalog(uid, next);
    return {
      addBlockType(name: string, color: ColorKey): string {
        const type: BlockType = { id: shortId(), name: name.trim(), color };
        save({ ...catalog, blockTypes: [...catalog.blockTypes, type] });
        return type.id;
      },
      updateBlockType(id: string, patch: Partial<Omit<BlockType, "id">>) {
        save({ ...catalog, blockTypes: catalog.blockTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
      },
      removeBlockType(id: string) {
        save({ ...catalog, blockTypes: catalog.blockTypes.filter((t) => t.id !== id) });
      },
      addMuscleGroup(name: string) {
        const n = name.trim();
        if (!n || catalog.muscleGroups.some((g) => g.toLowerCase() === n.toLowerCase())) return;
        save({ ...catalog, muscleGroups: [...catalog.muscleGroups, n] });
      },
      removeMuscleGroup(name: string) {
        save({ ...catalog, muscleGroups: catalog.muscleGroups.filter((g) => g !== name) });
      },
      rebuildLogs: () => rebuildExerciseLogs(uid),
    };
  }, [uid, catalog]);
}
