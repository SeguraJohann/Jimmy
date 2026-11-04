import { useMemo, useState } from "react";
import type { Equipment, LogType } from "@/types/models";
import { Sheet } from "@/components/ui/Sheet";
import { Segmented } from "@/components/ui/misc";
import { useT } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useExerciseActions } from "../useExerciseActions";
import { useCatalogActions } from "@/features/catalog/useCatalogActions";
import { exerciseSchema } from "../schema";
import { normalize } from "@/lib/utils/text";
import { toast } from "@/lib/utils/toast";

const EQUIPMENT: Equipment[] = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "other"];
const NEW_GROUP = "__new__";

/** M2: create / edit an exercise. */
export function ExerciseFormSheet({
  exerciseId,
  initialName,
  onSaved,
  onClose,
}: {
  exerciseId?: string;
  initialName?: string;
  onSaved?: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { exercises, exercisesById, catalog, logsById } = useData();
  const actions = useExerciseActions();
  const catalogActions = useCatalogActions();
  const existing = exerciseId ? exercisesById.get(exerciseId) : undefined;
  const hasHistory = !!existing && Object.keys(logsById.get(existing.id)?.entries ?? {}).length > 0;

  const [name, setName] = useState(existing?.name ?? initialName ?? "");
  const [group, setGroup] = useState(existing?.muscleGroup ?? catalog.muscleGroups[0] ?? "");
  const [newGroup, setNewGroup] = useState("");
  const [equipment, setEquipment] = useState<Equipment | "">(existing?.equipment ?? "");
  const [logType, setLogType] = useState<LogType>(existing?.logType ?? "weight_reps");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const list = [...catalog.muscleGroups];
    if (existing?.muscleGroup && !list.includes(existing.muscleGroup)) list.push(existing.muscleGroup);
    return list;
  }, [catalog.muscleGroups, existing]);

  function submit() {
    const muscleGroup = group === NEW_GROUP ? newGroup.trim() : group;
    const parsed = exerciseSchema.safeParse({ name, muscleGroup, equipment: equipment || null, logType, notes: notes.trim() || null });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t.app.genericError);
      return;
    }
    const key = normalize(parsed.data.name);
    if (exercises.some((e) => e.id !== exerciseId && normalize(e.name) === key)) {
      setError(t.exercises.nameTaken);
      return;
    }
    if (group === NEW_GROUP && muscleGroup) catalogActions.addMuscleGroup(muscleGroup);
    if (existing) {
      actions.update(existing.id, parsed.data);
      onClose();
      onSaved?.(existing.id);
    } else {
      const id = actions.create(parsed.data);
      toast(t.exercises.created);
      onClose();
      onSaved?.(id);
    }
  }

  return (
    <Sheet
      title={existing ? t.exercises.formTitleEdit : t.exercises.formTitleNew}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button className="btn acc" onClick={submit}>
            {t.common.save}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="ex-name">{t.exercises.name}</label>
        <input
          id="ex-name"
          className={`inp ${error ? "err" : ""}`}
          value={name}
          placeholder={t.exercises.namePlaceholder}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          autoFocus={!existing}
        />
        {error && <p className="err-text">{error}</p>}
      </div>
      <div className="field">
        <label htmlFor="ex-group">{t.exercises.group}</label>
        <select id="ex-group" className="inp" value={group} onChange={(e) => setGroup(e.target.value)}>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
          <option value={NEW_GROUP}>＋ {t.exercises.newGroup}</option>
        </select>
        {group === NEW_GROUP && <input className="inp" value={newGroup} placeholder={t.exercises.newGroupPlaceholder} onChange={(e) => setNewGroup(e.target.value)} autoFocus />}
      </div>
      <div className="field">
        <label htmlFor="ex-eq">
          {t.exercises.equipment} ({t.common.optional})
        </label>
        <select id="ex-eq" className="inp" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment | "")}>
          <option value="">{t.common.none}</option>
          {EQUIPMENT.map((q) => (
            <option key={q} value={q}>
              {t.equipment[q]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span className="lbl">{t.exercises.logType}</span>
        {hasHistory ? (
          <p className="muted">
            {t.logType[logType]} · {t.exercises.logTypeLocked}
          </p>
        ) : (
          <Segmented
            value={logType}
            onChange={setLogType}
            label={t.exercises.logType}
            options={(["weight_reps", "reps", "time"] as LogType[]).map((v) => ({ value: v, label: t.logType[v] }))}
          />
        )}
      </div>
      <div className="field">
        <label htmlFor="ex-notes">
          {t.exercises.notes} ({t.common.optional})
        </label>
        <input id="ex-notes" className="inp" value={notes} placeholder={t.exercises.notesPlaceholder} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Sheet>
  );
}
