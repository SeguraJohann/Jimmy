import { useState } from "react";
import type { BlockExercise, ColorKey, CycleDay, Routine, WeightUnit } from "@/types/models";
import { Sheet } from "@/components/ui/Sheet";
import { CloseIcon, DeleteIcon, MoveDownIcon, MoveUpIcon } from "@/components/icons";
import { TypeDot } from "@/components/ui/misc";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useCatalogActions } from "@/features/catalog/useCatalogActions";
import { APP_CONFIG } from "@/config/app.config";
import { dayName, moveInArray, orderedBlockIds } from "@/lib/routine/routine";
import { parseDecimal, parseInteger, toInputValue } from "@/lib/utils/number";
import { colorVar } from "@/styles/semantic";
import styles from "./Routines.module.css";
import { fromUnitOrNull, toUnitOrNull } from "@/lib/utils/units";

const NEW_TYPE = "__new__";

/** M4: create / edit a block (name + shared type). */
export function BlockFormSheet({
  initial,
  defaultName,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: { name: string; typeId: string };
  defaultName?: string;
  onSave: (name: string, typeId: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const { catalog } = useData();
  const catalogActions = useCatalogActions();
  const [name, setName] = useState(initial?.name ?? defaultName ?? "");
  const [typeId, setTypeId] = useState(initial?.typeId ?? catalog.blockTypes[0]?.id ?? NEW_TYPE);
  const [newType, setNewType] = useState("");
  const [color, setColor] = useState<ColorKey>(APP_CONFIG.colors[catalog.blockTypes.length % APP_CONFIG.colors.length]);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!name.trim()) {
      setError(t.blockForm.nameRequired);
      return;
    }
    let tid = typeId;
    if (typeId === NEW_TYPE) {
      if (!newType.trim()) return;
      tid = catalogActions.addBlockType(newType, color);
    }
    onClose();
    onSave(name.trim(), tid);
  }

  return (
    <Sheet
      title={initial ? t.blockForm.titleEdit : t.blockForm.titleNew}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {onDelete && (
            <button
              className="btn danger"
              style={{ marginRight: "auto" }}
              onClick={() => {
                onClose();
                onDelete();
              }}
            >
              <DeleteIcon size={16} />
            </button>
          )}
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
        <label htmlFor="blk-name">{t.blockForm.name}</label>
        <input
          id="blk-name"
          className={`inp ${error ? "err" : ""}`}
          value={name}
          placeholder={t.blockForm.namePlaceholder}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          autoFocus={!initial}
        />
        {error && <p className="err-text">{error}</p>}
      </div>
      <div className="field">
        <span className="lbl">{t.blockForm.type}</span>
        <div className="chips">
          {catalog.blockTypes.map((bt) => (
            <button key={bt.id} className={`chip ${typeId === bt.id ? "sel" : ""}`} onClick={() => setTypeId(bt.id)}>
              <TypeDot color={bt.color} />
              {bt.name}
            </button>
          ))}
          <button className={`chip ${typeId === NEW_TYPE ? "sel" : ""}`} onClick={() => setTypeId(NEW_TYPE)}>
            ＋ {t.blockForm.newType}
          </button>
        </div>
        <p className="hint">{t.blockForm.typeHint}</p>
      </div>
      {typeId === NEW_TYPE && (
        <>
          <input className="inp" value={newType} placeholder={t.blockForm.newTypePlaceholder} onChange={(e) => setNewType(e.target.value)} aria-label={t.blockForm.newType} />
          <ColorPicker value={color} onChange={setColor} />
        </>
      )}
    </Sheet>
  );
}

export function ColorPicker({ value, onChange }: { value: ColorKey; onChange: (c: ColorKey) => void }) {
  const t = useT();
  return (
    <div className="field">
      <span className="lbl">{t.blockForm.color}</span>
      <div className={styles.colors} role="radiogroup" aria-label={t.blockForm.color}>
        {APP_CONFIG.colors.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={c === value}
            aria-label={t.colors[c]}
            title={t.colors[c]}
            className={`${styles.swatch} ${c === value ? styles.swatchOn : ""}`}
            style={{ background: colorVar(c) }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  );
}

/** M5: target of an exercise inside a block. */
export function TargetSheet({
  exerciseName,
  weightUnit = "kg",
  value,
  onSave,
  onRemove,
  onClose,
}: {
  exerciseName: string;
  weightUnit?: WeightUnit;
  value: BlockExercise;
  onSave: (v: BlockExercise) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [sets, setSets] = useState(toInputValue(value.targetSets));
  const [min, setMin] = useState(toInputValue(value.targetRepsMin));
  const [max, setMax] = useState(toInputValue(value.targetRepsMax));
  const [weight, setWeight] = useState(toInputValue(toUnitOrNull(value.targetWeight, weightUnit)));
  const [note, setNote] = useState(value.note ?? "");

  function submit() {
    let lo = parseInteger(min);
    let hi = parseInteger(max);
    if (lo !== null && hi !== null && lo > hi) [lo, hi] = [hi, lo];
    onClose();
    onSave({ ...value, targetSets: parseInteger(sets), targetRepsMin: lo, targetRepsMax: hi, targetWeight: fromUnitOrNull(parseDecimal(weight), weightUnit), note: note.trim() || null });
  }

  const num = (id: string, label: string, v: string, set: (s: string) => void, decimal = false) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="inp" inputMode={decimal ? "decimal" : "numeric"} value={v} onChange={(e) => set(e.target.value)} />
    </div>
  );

  return (
    <Sheet
      eyebrow={t.target.title}
      title={exerciseName}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button
            className="btn danger"
            style={{ marginRight: "auto" }}
            onClick={() => {
              onClose();
              onRemove();
            }}
          >
            <DeleteIcon size={16} />
            {t.target.remove}
          </button>
          <button className="btn acc" onClick={submit}>
            {t.common.save}
          </button>
        </>
      }
    >
      <div className={styles.grid2}>
        {num("tg-sets", t.target.sets, sets, setSets)}
        {num("tg-w", fmt(t.target.weight, { unit: weightUnit === "lb" ? t.common.lb : t.common.kg }), weight, setWeight, true)}
        {num("tg-min", t.target.repsMin, min, setMin)}
        {num("tg-max", t.target.repsMax, max, setMax)}
      </div>
      <div className="field">
        <label htmlFor="tg-note">{t.target.note}</label>
        <input id="tg-note" className="inp" value={note} placeholder={t.target.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Sheet>
  );
}

/** M6: pick and order the blocks of a cycle day; optional custom name. */
export function CycleDaySheet({
  routine,
  day,
  number,
  onSave,
  onClose,
}: {
  routine: Pick<Routine, "blocks">;
  day: CycleDay;
  number: number;
  onSave: (d: CycleDay) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { catalog } = useData();
  const [blockIds, setBlockIds] = useState(day.blockIds.filter((id) => routine.blocks[id]));
  const [name, setName] = useState(day.name ?? "");
  const all = orderedBlockIds(routine);
  const available = all.filter((id) => !blockIds.includes(id));
  const typeColor = (id: string) => catalog.blockTypes.find((x) => x.id === routine.blocks[id]?.typeId)?.color ?? null;

  function submit() {
    onClose();
    onSave({ ...day, name: name.trim() || null, blockIds });
  }

  return (
    <Sheet
      title={fmt(t.dayForm.title, { n: number })}
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
      {all.length === 0 ? (
        <p className="muted">{t.dayForm.noBlocks}</p>
      ) : (
        <>
          <span className="lbl">{t.dayForm.blocks}</span>
          {blockIds.length === 0 && <p className="muted">{t.dayForm.noneSelected}</p>}
          {blockIds.map((id, i) => (
            <div key={id} className={styles.dayBlock}>
              <TypeDot color={typeColor(id)} />
              <b className="grow">{routine.blocks[id]?.name}</b>
              <button className="btn sm icon ghost" aria-label={t.common.moveUp} disabled={i === 0} onClick={() => setBlockIds((l) => moveInArray(l, i, -1))}>
                <MoveUpIcon size={16} />
              </button>
              <button className="btn sm icon ghost" aria-label={t.common.moveDown} disabled={i === blockIds.length - 1} onClick={() => setBlockIds((l) => moveInArray(l, i, 1))}>
                <MoveDownIcon size={16} />
              </button>
              <button className="btn sm icon ghost" aria-label={t.common.remove} onClick={() => setBlockIds((l) => l.filter((x) => x !== id))}>
                <CloseIcon size={16} />
              </button>
            </div>
          ))}
          {available.length > 0 && (
            <>
              <span className="lbl">{t.dayForm.available}</span>
              <div className="chips">
                {available.map((id) => (
                  <button key={id} className="chip" onClick={() => setBlockIds((l) => [...l, id])}>
                    <TypeDot color={typeColor(id)} />＋ {routine.blocks[id].name}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      <div className="field">
        <label htmlFor="day-name">
          {t.dayForm.name} ({t.common.optional})
        </label>
        <input
          id="day-name"
          className="inp"
          value={name}
          placeholder={fmt(t.dayForm.namePlaceholder, { auto: dayName(routine, { ...day, name: null, blockIds }) || "—" })}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
    </Sheet>
  );
}
