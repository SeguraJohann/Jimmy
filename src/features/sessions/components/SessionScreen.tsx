import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Session, SessionExercise, WeightUnit } from "@/types/models";
import { AddIcon, CheckIcon, DateIcon, DeleteIcon, EditIcon, FinishIcon, MoreIcon, NextIcon, PrevIcon, RoutinesIcon } from "@/components/icons";
import { Empty, Loading, TypeDot } from "@/components/ui/misc";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useToday } from "@/features/data/ClockContext";
import { useSession } from "@/features/data/hooks";
import { useModals } from "@/features/modals/ModalContext";
import { useSessionActions } from "../useSessionActions";
import { rowStatus, sessionDurationMin, sessionParts, sessionSummary } from "@/lib/session/session";
import { rowHasRecord } from "@/lib/session/records";
import { formatTarget, sessionTitle, setsLine } from "@/lib/session/format";
import { formatNumber } from "@/lib/utils/number";
import { formatDuration, relativeDate } from "@/lib/date/format";
import { routineExerciseIds } from "@/lib/routine/routine";
import { monthKey } from "@/lib/date/dateKey";
import { paths } from "@/routes/paths";
import { SessionTimer } from "./SessionTimer";
import { NotesField } from "./NotesField";
import styles from "./Sessions.module.css";

/** Rows grouped by consecutive block (S3). */
function groups(rows: SessionExercise[]): { key: string; blockName: string | null; color: SessionExercise["blockColor"]; rows: SessionExercise[] }[] {
  const out: { key: string; blockName: string | null; color: SessionExercise["blockColor"]; rows: SessionExercise[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.key === (r.blockId ?? "_none")) last.rows.push(r);
    else out.push({ key: r.blockId ?? "_none", blockName: r.blockName, color: r.blockColor, rows: [r] });
  }
  return out;
}

/** V3 (in progress) and V11 (past session, read mode + edit). */
export default function SessionScreen() {
  const t = useT();
  const { id } = useParams();
  const { data: session, loading } = useSession(id ?? null);
  if (loading) return <Loading />;
  if (!session) {
    return (
      <>
        <Link to={paths.home} className="back">
          <PrevIcon size={18} />
          {t.nav.home}
        </Link>
        <Empty>{t.session.notFound}</Empty>
      </>
    );
  }
  return <SessionView session={session} />;
}

function SessionView({ session }: { session: Session }) {
  const t = useT();
  const navigate = useNavigate();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const { logsById, routinesById, exercisesById } = useData();
  const { open } = useModals();
  const actions = useSessionActions();
  const [editing, setEditing] = useState(false);
  const inProgress = session.status === "in_progress";
  const editable = inProgress || editing;
  const summary = sessionSummary(session);

  // Free session: open the picker right away (?agregar=1 from New session).
  const sessionRef = useRef(session);
  useLayoutEffect(() => {
    sessionRef.current = session;
  });
  const addExercise = () => {
    const routine = session.routineId ? routinesById.get(session.routineId) : undefined;
    open({
      type: "exercisePicker",
      highlightIds: routine ? [...routineExerciseIds(routine)] : undefined,
      note: t.picker.sessionHint,
      onPick: (exerciseId) => {
        const rowId = actions.addExercise(sessionRef.current, exerciseId);
        if (rowId) navigate(paths.sessionRow(sessionRef.current.id, rowId));
      },
    });
  };
  useEffect(() => {
    if (params.get("agregar") === "1") {
      setParams({}, { replace: true });
      addExercise();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const records = useMemo(() => {
    const out = new Set<string>();
    for (const r of session.exercises) if (rowHasRecord(r, logsById.get(r.exerciseId), session.id, session.date)) out.add(r.id);
    return out;
  }, [session, logsById]);

  const changeDate = () => open({ type: "pickDate", title: t.session.changeDate, initial: session.date, max: today, onPick: (d) => actions.changeDate(sessionRef.current, d) });

  const remove = () =>
    open({
      type: "confirm",
      title: t.session.deleteSession,
      lines: [fmt(t.session.sets, { n: summary.sets })],
      confirmLabel: t.common.delete,
      danger: true,
      onConfirm: () => {
        actions.remove(sessionRef.current);
        navigate(paths.historyMonth(monthKey(session.date)), { replace: true });
      },
    });

  const stopEditing = () => {
    actions.saveEdited(sessionRef.current);
    setEditing(false);
  };

  const backTo = inProgress ? paths.home : paths.historyMonth(monthKey(session.date));

  return (
    <>
      <div className="top">
        <Link to={backTo} className="back">
          <PrevIcon size={18} />
          {inProgress ? t.nav.home : t.nav.history}
        </Link>
        {inProgress ? <SessionTimer startedAt={session.startedAt} /> : <span className="muted">{formatDuration(sessionDurationMin(session))}</span>}
      </div>
      <div>
        <p className="eyebrow">
          {session.routineName && session.extraParts.length === 0
            ? fmt(t.session.eyebrow, { routine: session.routineName, n: session.cycleDayNumber ?? "–", date: relativeDate(session.date, today) })
            : fmt(t.session.eyebrowFree, { date: relativeDate(session.date, today) })}
        </p>
        <h1 className="h1">
          {session.extraParts.length > 0
            ? sessionParts(session)
                .map((p) => p.dayName || p.routineName)
                .join(" + ")
            : session.dayName || (session.routineName ? sessionTitle(session) : t.session.free)}
        </h1>
        {session.extraParts.length > 0 && <p className="muted">{[...new Set(sessionParts(session).map((p) => p.routineName))].join(" + ")}</p>}
      </div>
      <div className="row muted" style={{ flexWrap: "wrap", gap: 8 }}>
        <span>{fmt(t.session.progress, { done: summary.exercisesDone, total: summary.exercisesTotal })}</span>
        <span>·</span>
        <span>{fmt(t.session.sets, { n: summary.sets })}</span>
        {summary.volume > 0 && (
          <>
            <span>·</span>
            <span>{fmt(t.session.volume, { v: formatNumber(summary.volume, 0) })}</span>
          </>
        )}
      </div>

      <div className="cols">
        <div className="stack sm">
          {session.exercises.length === 0 && <Empty>{t.session.emptyFree}</Empty>}
          {groups(session.exercises).map((g) => (
            <div key={g.key + g.rows[0].id} className="stack sm">
              {(g.blockName || session.routineId) && (
                <p className={styles.grp}>
                  <TypeDot color={g.color} />
                  {g.blockName ?? t.session.other}
                </p>
              )}
              {g.rows.map((r) => (
                <RowItem
                  key={r.id}
                  row={r}
                  unit={exercisesById.get(r.exerciseId)?.weightUnit ?? "kg"}
                  record={records.has(r.id)}
                  editable={editable}
                  inProgress={inProgress}
                  to={paths.sessionRow(session.id, r.id)}
                  onMenu={() => open({ type: "rowOptions", sessionId: session.id, rowId: r.id })}
                />
              ))}
            </div>
          ))}
          {editable && (
            <button className="dashed" onClick={addExercise}>
              <AddIcon size={18} />
              {t.session.addExercise}
            </button>
          )}
          {editable && (
            <button className="dashed" onClick={() => open({ type: "addRoutine", sessionId: session.id })}>
              <RoutinesIcon size={18} />
              {t.addRoutine.button}
            </button>
          )}
        </div>
        <section className="card stack">
          <span className="lbl">{t.session.notes}</span>
          {editable ? (
            <NotesField value={session.notes ?? ""} label={t.session.notes} placeholder={t.session.notesPlaceholder} onSave={(notes) => actions.update(sessionRef.current, (s) => ({ ...s, notes: notes.trim() || null }))} />
          ) : (
            <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
              {session.notes || "—"}
            </p>
          )}
        </section>
      </div>

      {inProgress ? (
        <>
          <button className="btn acc full" onClick={() => open({ type: "finishSession", sessionId: session.id })}>
            <FinishIcon size={18} />
            {t.session.finish}
          </button>
          <div className="row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn sm ghost" onClick={changeDate}>
              <DateIcon size={16} />
              {t.session.changeDate}
            </button>
            <button
              className="btn sm ghost"
              onClick={() =>
                open({
                  type: "confirm",
                  title: t.finish.discardTitle,
                  lines: [fmt(t.session.sets, { n: summary.sets })],
                  confirmLabel: t.finish.discard,
                  danger: true,
                  onConfirm: () => {
                    actions.remove(sessionRef.current);
                    navigate(paths.home, { replace: true });
                  },
                })
              }
            >
              <DeleteIcon size={16} />
              {t.session.discard}
            </button>
          </div>
        </>
      ) : (
        <>
          {!editing && <p className="hint">{t.session.readOnlyHint}</p>}
          <div className="row" style={{ flexWrap: "wrap" }}>
            {editing ? (
              <button className="btn acc" style={{ flex: 1 }} onClick={stopEditing}>
                <CheckIcon size={18} />
                {t.session.stopEditing}
              </button>
            ) : (
              <button className="btn acc" style={{ flex: 1 }} onClick={() => setEditing(true)}>
                <EditIcon size={18} />
                {t.session.editSession}
              </button>
            )}
            <button className="btn" onClick={changeDate} aria-label={t.session.changeDate} title={t.session.changeDate}>
              <DateIcon size={18} />
            </button>
            <button className="btn danger" onClick={remove} aria-label={t.session.deleteSession} title={t.session.deleteSession}>
              <DeleteIcon size={18} />
            </button>
          </div>
        </>
      )}
    </>
  );
}

function RowItem({ row, unit, record, editable, inProgress, to, onMenu }: { row: SessionExercise; unit: WeightUnit; record: boolean; editable: boolean; inProgress: boolean; to: string; onMenu: () => void }) {
  const t = useT();
  const st = rowStatus(row);
  const done = setsLine(row.sets, row.logType, unit);
  const target = formatTarget(row.target, unit);
  const index = st === "done" ? "✓" : "";
  const sub = st === "skipped" ? t.session.skipped : done || (target ? fmt(t.session.target, { target }) : inProgress ? t.session.noTarget : t.session.notDone);
  const body = (
    <>
      <span className={`${styles.st} ${st === "done" ? styles.stDone : st === "in_progress" ? styles.stNow : ""}`}>{index}</span>
      <span className="grow">
        <b className="ellipsis" style={{ display: "block" }}>
          {row.exerciseName}
        </b>
        <span className={styles.exSets}>{sub}</span>
      </span>
      {record && <span className="chip pr">{t.session.record}</span>}
      {!record && st === "in_progress" && inProgress && <span className="chip acc">{t.session.inProgress}</span>}
      {editable && <NextIcon size={18} className="arrow" />}
    </>
  );
  return (
    <div className={`${styles.ex} ${st === "in_progress" ? styles.exNow : ""} ${st === "skipped" ? styles.exSkipped : ""}`}>
      {editable ? (
        <Link to={to} className={styles.exMain}>
          {body}
        </Link>
      ) : (
        <div className={styles.exMain}>{body}</div>
      )}
      {editable && (
        <button className={styles.exMenu} onClick={onMenu} aria-label={t.common.more}>
          <MoreIcon size={20} />
        </button>
      )}
    </div>
  );
}
