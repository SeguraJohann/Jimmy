import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import type { LogType, Session, SessionExercise, SetEntry, WeightUnit } from "@/types/models";
import { CheckIcon, CloseIcon, NextIcon, PrevIcon } from "@/components/icons";
import { Loading, Segmented } from "@/components/ui/misc";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useSession } from "@/features/data/hooks";
import { useSessionActions } from "../useSessionActions";
import { APP_CONFIG } from "@/config/app.config";
import { lastEntry, pointsOf } from "@/lib/metrics/points";
import { computeRecords } from "@/lib/metrics/records";
import type { LiveRecord } from "@/lib/metrics/records";
import { addSet, nextRowId, stepWeight, suggestedValue } from "@/lib/session/session";
import { rowRecords } from "@/lib/session/records";
import { bestMark, formatLogSet, formatTarget } from "@/lib/session/format";
import { formatNumber, parseDecimal, parseInteger, toInputValue } from "@/lib/utils/number";
import { fromUnitOrNull, toUnitOrNull } from "@/lib/utils/units";
import { useExerciseActions } from "@/features/exercises/useExerciseActions";
import { relativeDate } from "@/lib/date/format";
import { toast } from "@/lib/utils/toast";
import { useToday } from "@/features/data/ClockContext";
import { paths } from "@/routes/paths";
import { SessionTimer } from "./SessionTimer";
import { NotesField } from "./NotesField";
import { useRestTimer } from "../rest/RestTimerContext";
import styles from "./Sessions.module.css";

/** V4: log the sets of one exercise. */
export default function ExerciseLogScreen() {
  const { id, rowId } = useParams();
  const { data: session, loading } = useSession(id ?? null);
  if (loading) return <Loading />;
  if (!session) return <Navigate to={paths.home} replace />;
  const row = session.exercises.find((r) => r.id === rowId);
  if (!row) return <Navigate to={paths.session(session.id)} replace />;
  return <LogView key={row.id} session={session} row={row} />;
}

function LogView({ session, row }: { session: Session; row: SessionExercise }) {
  const t = useT();
  const navigate = useNavigate();
  const today = useToday();
  const { logsById, exercisesById } = useData();
  const actions = useSessionActions();
  const exerciseActions = useExerciseActions();
  const rest = useRestTimer();
  const exercise = exercisesById.get(row.exerciseId);
  const unit: WeightUnit = exercise?.weightUnit ?? "kg";
  const step = APP_CONFIG.weightStep[unit];
  const unitLabel = unit === "lb" ? t.common.lb : t.common.kg;

  // Always write on top of the latest snapshot.
  const sessionRef = useRef(session);
  useLayoutEffect(() => {
    sessionRef.current = session;
  });
  const update = (mutate: (r: SessionExercise) => SessionExercise) => actions.updateRow(sessionRef.current, row.id, mutate);

  const log = logsById.get(row.exerciseId);
  const last = useMemo(() => lastEntry(log, { blockId: row.blockId, excludeSessionId: session.id, beforeOrOn: session.date }), [log, row.blockId, session.id, session.date]);
  const prevRecords = useMemo(() => {
    const entries = { ...(log?.entries ?? {}) };
    delete entries[session.id];
    return computeRecords(pointsOf({ exerciseId: row.exerciseId, entries }, row.logType));
  }, [log, row.exerciseId, row.logType, session.id]);
  const recs = useMemo(() => rowRecords(row, log, session.id, session.date), [row, log, session.id, session.date]);

  const index = session.exercises.findIndex((r) => r.id === row.id);
  const nextId = nextRowId(session, row.id);
  const next = nextId ? session.exercises.find((r) => r.id === nextId) : null;
  const target = formatTarget(row.target, unit);
  const record = bestMark(prevRecords, row.logType, unit);
  const single = row.logType !== "weight_reps";

  function setValues(i: number, patch: Partial<SetEntry>) {
    update((r) => ({ ...r, sets: r.sets.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));
  }

  function toggle(i: number, typed: { weight: number | null; value: number | null }) {
    const s = row.sets[i];
    if (s.done) {
      setValues(i, { done: false });
      return;
    }
    const value = typed.value ?? suggestedValue(row, i, last?.entry ?? null);
    if (value === null || value <= 0) {
      toast(t.log.needValue);
      return;
    }
    const patch: Partial<SetEntry> = row.logType === "time" ? { seconds: value } : { reps: value };
    if (row.logType === "weight_reps") patch.weight = fromUnitOrNull(typed.weight, unit);
    setValues(i, { ...patch, done: true });
    if (session.status === "in_progress") rest.onSetDone();
  }

  return (
    <>
      <div className="top">
        <Link to={paths.session(session.id)} className="back">
          <PrevIcon size={18} />
          {t.log.backToSession}
        </Link>
        {session.status === "in_progress" && <SessionTimer startedAt={session.startedAt} small />}
      </div>
      <div>
        <p className="eyebrow">
          {row.blockName ? fmt(t.log.eyebrow, { block: row.blockName, i: index + 1, n: session.exercises.length }) : fmt(t.log.eyebrowFree, { i: index + 1, n: session.exercises.length })}
        </p>
        <h1 className="h1">{row.exerciseName}</h1>
      </div>

      <section className="card stack">
        <div className="top">
          <span className="lbl">{last ? fmt(t.log.lastTime, { date: relativeDate(last.entry.date, today) }) : t.log.noLastTime}</span>
          <Link to={paths.exercise(row.exerciseId)} className="lnk">
            {t.log.seeProgress}
            <NextIcon size={16} />
          </Link>
        </div>
        {last && (
          <div className={styles.last}>
            {last.entry.sets.map((s, i) => (
              <span key={i}>{formatLogSet(s, row.logType, unit)}</span>
            ))}
          </div>
        )}
        {(target || record || row.target?.note) && (
          <p className="muted">
            {[target && fmt(t.log.targetLine, { target }), row.target?.note, record && fmt(t.log.recordLine, { record })].filter(Boolean).join(" · ")}
          </p>
        )}
      </section>

      {row.skipped ? (
        <section className="card row">
          <p className="muted grow">{t.log.skippedNote}</p>
          <button className="btn sm" onClick={() => update((r) => ({ ...r, skipped: false }))}>
            {t.log.resume}
          </button>
        </section>
      ) : (
        <section className={`card ${styles.setsCard}`}>
          {!single && exercise && (
            <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
              <span className="lbl">{t.log.unit}</span>
              <Segmented value={unit} onChange={(u) => exerciseActions.setUnit(exercise.id, u)} label={t.log.unit} options={(["kg", "lb"] as WeightUnit[]).map((v) => ({ value: v, label: v === "lb" ? t.common.lb : t.common.kg }))} />
            </div>
          )}
          <div className={`${styles.unit} ${single ? styles.single : ""}`}>
            <span>{t.log.colSet}</span>
            {!single && <span>{fmt(t.log.colWeight, { unit: unitLabel })}</span>}
            {!single && <span />}
            <span>{row.logType === "time" ? t.log.colSeconds : t.log.colReps}</span>
            <span />
            <span />
          </div>
          {row.sets.map((s, i) => (
            <SetRow
              key={`${i}-${row.sets.length}`}
              index={i}
              set={s}
              logType={row.logType}
              unit={unit}
              suggestion={suggestedValue(row, i, last?.entry ?? null)}
              record={recs[i] ?? null}
              onCommit={(patch) => setValues(i, patch)}
              onToggle={(typed) => toggle(i, typed)}
              onDelete={() => update((r) => ({ ...r, sets: r.sets.filter((_, k) => k !== i) }))}
            />
          ))}
          <div className={styles.step}>
            {row.logType === "weight_reps" && (
              <>
                <button onClick={() => update((r) => stepWeight(r, -step, unit))}>{fmt(t.log.minus, { step: formatNumber(step), unit: unitLabel })}</button>
                <button onClick={() => update((r) => stepWeight(r, step, unit))}>{fmt(t.log.plus, { step: formatNumber(step), unit: unitLabel })}</button>
              </>
            )}
            <button onClick={() => update(addSet)}>{t.log.addSet}</button>
          </div>
          <p className="hint">{t.log.hint}</p>
        </section>
      )}

      <NotesField
        value={row.notes ?? ""}
        label={t.log.notes}
        placeholder={t.log.notes}
        rows={2}
        onSave={(notes) => update((r) => ({ ...r, notes: notes.trim() || null }))}
      />

      <div className="row" style={{ flexWrap: "wrap" }}>
        <Link className="btn" to={paths.session(session.id)} style={{ flex: "1 1 120px" }}>
          {t.log.list}
        </Link>
        {next ? (
          <button className="btn acc" style={{ flex: "2 1 200px", minWidth: 0 }} onClick={() => navigate(paths.sessionRow(session.id, next.id), { replace: true })}>
            <span className="ellipsis">{fmt(t.log.next, { name: next.exerciseName })}</span>
            <NextIcon size={18} />
          </button>
        ) : (
          <Link className="btn acc" style={{ flex: "2 1 200px" }} to={paths.session(session.id)}>
            {t.log.allDone}
          </Link>
        )}
      </div>
    </>
  );
}

interface SetRowProps {
  index: number;
  set: SetEntry;
  logType: LogType;
  unit: WeightUnit;
  suggestion: number | null;
  record: LiveRecord;
  onCommit: (patch: Partial<SetEntry>) => void;
  onToggle: (typed: { weight: number | null; value: number | null }) => void;
  onDelete: () => void;
}

/** One set: local text while typing (keeps "57," intact), saved on blur or ✓. */
function SetRow({ index, set, logType, unit, suggestion, record, onCommit, onToggle, onDelete }: SetRowProps) {
  const t = useT();
  const valueOf = (s: SetEntry) => (logType === "time" ? s.seconds : s.reps);
  // Weight is typed and shown in the exercise's unit; stored in kg.
  const shownWeight = (s: SetEntry) => toInputValue(toUnitOrNull(s.weight, unit));
  const [w, setW] = useState(shownWeight(set));
  const [v, setV] = useState(toInputValue(valueOf(set)));
  const focused = useRef<"w" | "v" | null>(null);
  const n = index + 1;

  useEffect(() => {
    if (focused.current !== "w") setW(toInputValue(toUnitOrNull(set.weight, unit)));
    if (focused.current !== "v") setV(toInputValue(logType === "time" ? set.seconds : set.reps));
  }, [set, logType, unit]);

  const commitW = () => {
    focused.current = null;
    if (w.trim() === shownWeight(set)) return;
    onCommit({ weight: fromUnitOrNull(parseDecimal(w), unit) });
  };
  const commitV = () => {
    focused.current = null;
    const parsed = parseInteger(v);
    if (parsed !== valueOf(set)) onCommit(logType === "time" ? { seconds: parsed } : { reps: parsed });
  };
  const toggle = () => onToggle({ weight: parseDecimal(w), value: parseInteger(v) });
  const single = logType !== "weight_reps";

  return (
    <>
      <div className={`${styles.set} ${single ? styles.single : ""} ${set.done ? styles.setDone : ""}`}>
        <span className={styles.i}>{n}</span>
        {!single && (
          <>
            <input
              className={styles.v}
              inputMode="decimal"
              enterKeyHint="next"
              value={w}
              placeholder="–"
              aria-label={fmt(t.log.weightOf, { n })}
              onFocus={(e) => {
                focused.current = "w";
                e.target.select();
              }}
              onChange={(e) => setW(e.target.value)}
              onBlur={commitW}
            />
            <span className={styles.x}>×</span>
          </>
        )}
        <input
          className={styles.v}
          inputMode="numeric"
          enterKeyHint="done"
          value={v}
          placeholder={suggestion !== null ? String(suggestion) : "–"}
          aria-label={fmt(logType === "time" ? t.log.secondsOf : t.log.repsOf, { n })}
          onFocus={(e) => {
            focused.current = "v";
            e.target.select();
          }}
          onChange={(e) => setV(e.target.value)}
          onBlur={commitV}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
              if (!set.done) toggle();
            }
          }}
        />
        <button className={styles.ck} onClick={toggle} aria-label={fmt(set.done ? t.log.unmark : t.log.markDone, { n })} aria-pressed={set.done}>
          <CheckIcon size={24} />
        </button>
        <button className={styles.del} onClick={onDelete} aria-label={fmt(t.log.deleteSet, { n })}>
          <CloseIcon size={16} />
        </button>
      </div>
      {record && <p className={styles.prLine}>{t.log.rec[record]}</p>}
    </>
  );
}
