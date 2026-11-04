import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { BlockExercise, Routine } from "@/types/models";
import { AddIcon, ArchiveIcon, CloseIcon, DeleteIcon, DuplicateIcon, EditIcon, MoveDownIcon, MoveUpIcon, PrevIcon, UnarchiveIcon } from "@/components/icons";
import { Empty, TypeDot } from "@/components/ui/misc";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useModals } from "@/features/modals/ModalContext";
import { useRoutineActions } from "../useRoutineActions";
import type { RoutineDraft } from "../services/routines.service";
import {
  addBlock,
  dayName,
  daysUsingBlock,
  moveBlock,
  moveInArray,
  newBlockExercise,
  newCycleDay,
  orderedBlockIds,
  removeBlock,
  updateBlock,
} from "@/lib/routine/routine";
import { formatTarget } from "@/lib/session/format";
import { toast } from "@/lib/utils/toast";
import { paths } from "@/routes/paths";
import styles from "./Routines.module.css";

const EMPTY: RoutineDraft = { name: "", description: null, status: "active", blocks: {}, cycle: [] };

/** V6 wrapper: resolves the routine and mounts the editor with a fresh draft. */
export default function RoutineEditorScreen() {
  const t = useT();
  const { id } = useParams();
  const { routinesById } = useData();
  const isNew = id === "nueva";
  const routine = !isNew && id ? routinesById.get(id) : undefined;

  if (!isNew && !routine) {
    return (
      <>
        <Link to={paths.routines} className="back">
          <PrevIcon size={18} />
          {t.editor.back}
        </Link>
        <Empty>{t.app.notFound}</Empty>
      </>
    );
  }
  return <RoutineEditor key={id} routine={routine ?? null} />;
}

function RoutineEditor({ routine }: { routine: Routine | null }) {
  const t = useT();
  const navigate = useNavigate();
  const { open } = useModals();
  const { catalog, exercisesById } = useData();
  const actions = useRoutineActions();
  const initial: RoutineDraft = routine
    ? { name: routine.name, description: routine.description, status: routine.status, blocks: routine.blocks, cycle: routine.cycle }
    : EMPTY;
  const [draft, setDraft] = useState<RoutineDraft>(initial);
  const [nameError, setNameError] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  // Pure helpers work on a full Routine; the draft has the same editable shape.
  const asRoutine = (d: RoutineDraft): Routine => ({ ...d, id: routine?.id ?? "", createdAt: 0, updatedAt: 0 });
  const edit = (fn: (r: Routine) => Routine) =>
    setDraft((d) => {
      const r = fn(asRoutine(d));
      return { name: r.name, description: r.description, status: r.status, blocks: r.blocks, cycle: r.cycle };
    });

  const blockIds = orderedBlockIds(draft);
  const typeOf = (typeId: string) => catalog.blockTypes.find((x) => x.id === typeId);

  function save() {
    if (!draft.name.trim()) {
      setNameError(true);
      return;
    }
    actions.save({ ...draft, name: draft.name.trim(), description: draft.description?.trim() || null }, routine?.id);
    toast(t.editor.saved);
    // A new routine may not be in the live list yet: go back to the list instead.
    if (!routine) navigate(paths.routines, { replace: true });
  }

  function cancel() {
    if (!dirty) {
      navigate(paths.routines);
      return;
    }
    open({ type: "confirm", title: t.editor.unsavedTitle, lines: [t.editor.unsavedLines], confirmLabel: t.editor.discard, danger: true, onConfirm: () => navigate(paths.routines) });
  }

  // ---------- blocks ----------
  const newBlock = () =>
    open({
      type: "blockForm",
      onSave: (name, typeId) => edit((r) => addBlock(r, name, typeId).routine),
    });

  const editBlock = (bid: string) => {
    const b = draft.blocks[bid];
    open({
      type: "blockForm",
      initial: { name: b.name, typeId: b.typeId },
      onSave: (name, typeId) => edit((r) => updateBlock(r, bid, { name, typeId })),
      onDelete: () => {
        const days = daysUsingBlock(asRoutine(draft), bid);
        open({
          type: "confirm",
          title: fmt(t.editor.deleteBlockTitle, { name: b.name }),
          lines: [...(days.length ? [fmt(t.editor.deleteBlockUsed, { days: days.map((n) => fmt(t.editor.dayN, { n })).join(", ") })] : []), t.editor.deleteBlockLines],
          confirmLabel: t.common.delete,
          danger: true,
          onConfirm: () => edit((r) => removeBlock(r, bid)),
        });
      },
    });
  };

  const addExerciseTo = (bid: string) =>
    open({
      type: "exercisePicker",
      excludeIds: draft.blocks[bid].exercises.map((e) => e.exerciseId),
      onPick: (exerciseId) => edit((r) => updateBlock(r, bid, { exercises: [...r.blocks[bid].exercises, newBlockExercise(exerciseId)] })),
    });

  const editTarget = (bid: string, be: BlockExercise) =>
    open({
      type: "target",
      exerciseName: exercisesById.get(be.exerciseId)?.name ?? "—",
      value: be,
      onSave: (v) => edit((r) => updateBlock(r, bid, { exercises: r.blocks[bid].exercises.map((e) => (e.id === v.id ? v : e)) })),
      onRemove: () => edit((r) => updateBlock(r, bid, { exercises: r.blocks[bid].exercises.filter((e) => e.id !== be.id) })),
    });

  const moveExercise = (bid: string, i: number, delta: number) => edit((r) => updateBlock(r, bid, { exercises: moveInArray(r.blocks[bid].exercises, i, delta) }));

  // ---------- days ----------
  const editDay = (i: number) =>
    open({
      type: "cycleDay",
      routine: draft,
      day: draft.cycle[i],
      number: i + 1,
      onSave: (day) => setDraft((d) => ({ ...d, cycle: d.cycle.map((x) => (x.id === day.id ? day : x)) })),
    });

  const addDay = () => {
    // The day is only added when the sheet is saved (cancel leaves no empty day).
    open({
      type: "cycleDay",
      routine: draft,
      day: newCycleDay(),
      number: draft.cycle.length + 1,
      onSave: (saved) => setDraft((d) => ({ ...d, cycle: [...d.cycle, saved] })),
    });
  };

  const removeDay = (i: number) =>
    open({
      type: "confirm",
      title: fmt(t.editor.deleteDayTitle, { n: i + 1 }),
      lines: [t.editor.deleteDayLines],
      confirmLabel: t.common.remove,
      danger: true,
      onConfirm: () => setDraft((d) => ({ ...d, cycle: d.cycle.filter((_, k) => k !== i) })),
    });

  // ---------- routine actions ----------
  const duplicate = () => {
    if (!routine) return;
    const id = actions.duplicate(routine, `${routine.name} ${t.editor.copySuffix}`);
    toast(t.editor.duplicated);
    navigate(paths.routine(id));
  };

  const archiveToggle = () => {
    if (!routine) return;
    if (routine.status === "archived") {
      actions.setStatus(routine.id, "active");
      setDraft((d) => ({ ...d, status: "active" }));
      return;
    }
    open({
      type: "confirm",
      title: fmt(t.editor.archiveTitle, { name: routine.name }),
      lines: [t.editor.archiveLines],
      confirmLabel: t.common.archive,
      onConfirm: () => {
        actions.setStatus(routine.id, "archived");
        navigate(paths.routines);
      },
    });
  };

  const remove = async () => {
    if (!routine) return;
    let has = true;
    try {
      has = await actions.hasSessions(routine.id);
    } catch {
      has = true;
    }
    if (has) {
      open({
        type: "confirm",
        title: fmt(t.editor.archiveTitle, { name: routine.name }),
        lines: [t.editor.hasSessions, t.editor.archiveLines],
        confirmLabel: t.common.archive,
        onConfirm: () => {
          actions.setStatus(routine.id, "archived");
          navigate(paths.routines);
        },
      });
      return;
    }
    open({
      type: "confirm",
      title: fmt(t.editor.deleteTitle, { name: routine.name }),
      lines: [t.editor.deleteLines],
      confirmLabel: t.common.delete,
      danger: true,
      onConfirm: () => {
        actions.remove(routine.id);
        navigate(paths.routines, { replace: true });
      },
    });
  };

  return (
    <>
      <button className="back" onClick={cancel} style={{ alignSelf: "flex-start" }}>
        <PrevIcon size={18} />
        {t.editor.back}
      </button>
      <div className="top">
        <h1 className="h1 grow">{draft.name.trim() || t.editor.newTitle}</h1>
        {routine && (
          <div className="row">
            <button className="btn sm" onClick={duplicate}>
              <DuplicateIcon size={16} />
              {t.common.duplicate}
            </button>
            <button className="btn sm" onClick={archiveToggle}>
              {routine.status === "archived" ? <UnarchiveIcon size={16} /> : <ArchiveIcon size={16} />}
              {routine.status === "archived" ? t.common.unarchive : t.common.archive}
            </button>
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="rt-name">{t.editor.name}</label>
        <input
          id="rt-name"
          className={`inp ${nameError ? "err" : ""}`}
          value={draft.name}
          placeholder={t.editor.namePlaceholder}
          onChange={(e) => {
            setDraft((d) => ({ ...d, name: e.target.value }));
            setNameError(false);
          }}
        />
        {nameError && <p className="err-text">{t.editor.nameRequired}</p>}
      </div>
      <div className="field">
        <label htmlFor="rt-desc">
          {t.editor.description} ({t.common.optional})
        </label>
        <input id="rt-desc" className="inp" value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
      </div>

      <div className="cols">
        <section className={styles.section}>
          <div className="top">
            <span className="h2">{t.editor.cycle}</span>
            <button className="btn sm" onClick={addDay}>
              <AddIcon size={16} />
              {t.editor.addDay}
            </button>
          </div>
          <p className="muted">{t.editor.cycleHint}</p>
          {draft.cycle.map((day, i) => (
            <div key={day.id} className={styles.cyc}>
              <span className={styles.cycN}>{i + 1}</span>
              <button className={styles.cycBody} onClick={() => editDay(i)}>
                {day.name && <b>{day.name}</b>}
                <span className={styles.toks}>
                  {day.blockIds.filter((b) => draft.blocks[b]).length === 0 && <span className="muted">{t.editor.dayEmpty}</span>}
                  {day.blockIds
                    .filter((b) => draft.blocks[b])
                    .map((b) => (
                      <span key={b} className={styles.tok}>
                        <TypeDot color={typeOf(draft.blocks[b].typeId)?.color} />
                        {draft.blocks[b].name}
                      </span>
                    ))}
                </span>
              </button>
              <button className="btn sm icon ghost" aria-label={t.common.moveUp} disabled={i === 0} onClick={() => setDraft((d) => ({ ...d, cycle: moveInArray(d.cycle, i, -1) }))}>
                <MoveUpIcon size={16} />
              </button>
              <button
                className="btn sm icon ghost"
                aria-label={t.common.moveDown}
                disabled={i === draft.cycle.length - 1}
                onClick={() => setDraft((d) => ({ ...d, cycle: moveInArray(d.cycle, i, 1) }))}
              >
                <MoveDownIcon size={16} />
              </button>
              <button className="btn sm icon ghost" aria-label={t.common.remove} onClick={() => removeDay(i)}>
                <CloseIcon size={16} />
              </button>
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <div className="top">
            <span className="h2">{t.editor.blocks}</span>
            <button className="btn sm" onClick={newBlock}>
              <AddIcon size={16} />
              {t.editor.addBlock}
            </button>
          </div>
          <p className="muted">{t.editor.blocksHint}</p>
          {blockIds.length === 0 && (
            <div className="card">
              <Empty
                action={
                  <button className="btn acc" onClick={newBlock}>
                    <AddIcon size={16} />
                    {t.editor.addBlock}
                  </button>
                }
              >
                {t.editor.noBlocks}
              </Empty>
            </div>
          )}
          {blockIds.map((bid, bi) => {
            const b = draft.blocks[bid];
            const type = typeOf(b.typeId);
            return (
              <div key={bid} className={styles.bloque}>
                <div className={styles.bh}>
                  <TypeDot color={type?.color} />
                  <b className="ellipsis">{b.name}</b>
                  {type && <span className="chip">{fmt(t.editor.type, { name: type.name })}</span>}
                  <button className="btn sm icon ghost" aria-label={t.common.moveUp} disabled={bi === 0} onClick={() => edit((r) => moveBlock(r, bid, -1))}>
                    <MoveUpIcon size={16} />
                  </button>
                  <button className="btn sm icon ghost" aria-label={t.common.moveDown} disabled={bi === blockIds.length - 1} onClick={() => edit((r) => moveBlock(r, bid, 1))}>
                    <MoveDownIcon size={16} />
                  </button>
                  <button className="btn sm icon ghost" aria-label={t.editor.editBlock} onClick={() => editBlock(bid)}>
                    <EditIcon size={16} />
                  </button>
                </div>
                {b.exercises.map((be, i) => (
                  <div key={be.id} className={styles.bex}>
                    <button className={styles.bexMain} onClick={() => editTarget(bid, be)}>
                      <span className="grow ellipsis">{exercisesById.get(be.exerciseId)?.name ?? "—"}</span>
                      <span className={styles.obj}>
                        {formatTarget({ sets: be.targetSets, repsMin: be.targetRepsMin, repsMax: be.targetRepsMax, weight: be.targetWeight }) ?? <EditIcon size={14} />}
                      </span>
                    </button>
                    <button className="btn sm icon ghost" aria-label={t.common.moveUp} disabled={i === 0} onClick={() => moveExercise(bid, i, -1)}>
                      <MoveUpIcon size={16} />
                    </button>
                    <button className="btn sm icon ghost" aria-label={t.common.moveDown} disabled={i === b.exercises.length - 1} onClick={() => moveExercise(bid, i, 1)}>
                      <MoveDownIcon size={16} />
                    </button>
                  </div>
                ))}
                <div className={styles.bexAdd}>
                  <button className="lnk" onClick={() => addExerciseTo(bid)}>
                    <AddIcon size={16} />
                    {t.editor.addExercise}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <div className={styles.actions}>
        {routine && (
          <button className="btn danger" onClick={() => void remove()}>
            <DeleteIcon size={16} />
          </button>
        )}
        <button className="btn" onClick={cancel}>
          {t.common.cancel}
        </button>
        <button className="btn acc" style={{ flex: 1 }} onClick={save}>
          {t.editor.save}
        </button>
      </div>
      {draft.cycle.length > 0 && <p className="hint">{draft.cycle.map((d, i) => `${i + 1}. ${dayName(draft, d) || "—"}`).join("  ·  ")}</p>}
    </>
  );
}
