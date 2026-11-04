import { useMemo, useState } from "react";
import type { Exercise } from "@/types/models";
import { Sheet } from "@/components/ui/Sheet";
import { AddIcon, SearchIcon } from "@/components/icons";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useModals } from "@/features/modals/ModalContext";
import { matchesSearch } from "@/lib/utils/text";
import { routineExerciseIds } from "@/lib/routine/routine";
import styles from "./Exercises.module.css";

/** M1: pick an exercise. Archived ones are hidden. */
export function ExercisePickerSheet({
  highlightIds,
  excludeIds,
  note,
  onPick,
  onClose,
}: {
  highlightIds?: string[];
  excludeIds?: string[];
  note?: string;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { exercises, routines } = useData();
  const { replace } = useModals();
  const [query, setQuery] = useState("");

  const inAnyRoutine = useMemo(() => {
    const ids = new Set<string>();
    for (const r of routines) if (r.status === "active") for (const id of routineExerciseIds(r)) ids.add(id);
    return ids;
  }, [routines]);

  const { highlighted, others } = useMemo(() => {
    const hl = new Set(highlightIds ?? []);
    const ex = new Set(excludeIds ?? []);
    const list = exercises.filter((e) => !e.archived && !ex.has(e.id) && matchesSearch(`${e.name} ${e.muscleGroup}`, query));
    return { highlighted: list.filter((e) => hl.has(e.id)), others: list.filter((e) => !hl.has(e.id)) };
  }, [exercises, highlightIds, excludeIds, query]);

  const pick = (id: string) => {
    onClose();
    onPick(id);
  };

  const createNew = () => replace({ type: "exerciseForm", initialName: query.trim() || undefined, onSaved: onPick });

  const row = (e: Exercise, hl: boolean) => (
    <button key={e.id} className={`${styles.pick} ${hl ? styles.pickHl : ""}`} onClick={() => pick(e.id)}>
      <span className="grow">
        <b>{e.name}</b>
        <span className="muted" style={{ display: "block" }}>
          {e.muscleGroup}
          {!inAnyRoutine.has(e.id) && ` · ${t.picker.notInRoutine}`}
        </span>
      </span>
      <AddIcon size={20} />
    </button>
  );

  return (
    <Sheet title={t.picker.title} onClose={onClose}>
      <div className={styles.search}>
        <SearchIcon size={18} />
        <input className="inp" placeholder={t.picker.search} aria-label={t.picker.search} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      </div>
      {highlighted.length > 0 && <span className="lbl">{t.picker.fromRoutine}</span>}
      {highlighted.map((e) => row(e, true))}
      {highlighted.length > 0 && others.length > 0 && <span className="lbl">{t.picker.others}</span>}
      {others.map((e) => row(e, false))}
      {highlighted.length === 0 && others.length === 0 && <p className="muted">{t.picker.none}</p>}
      <button className={styles.pick} onClick={createNew}>
        <span className="grow">
          <b>{query.trim() ? fmt(t.picker.createNamed, { name: query.trim() }) : t.picker.create}</b>
        </span>
        <AddIcon size={20} />
      </button>
      {note && <p className="muted">{note}</p>}
    </Sheet>
  );
}
