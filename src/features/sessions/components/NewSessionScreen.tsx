import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import type { DateKey } from "@/types/models";
import { DateIcon, PrevIcon, RepeatIcon, StartIcon } from "@/components/icons";
import { Empty, TypeDot } from "@/components/ui/misc";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useToday } from "@/features/data/ClockContext";
import { useRecentSessions, useRoutineSessions } from "@/features/data/hooks";
import { useModals } from "@/features/modals/ModalContext";
import { useSessionActions } from "../useSessionActions";
import { dayName, suggestNextDay } from "@/lib/routine/routine";
import { agoText, relativeDate } from "@/lib/date/format";
import { paths } from "@/routes/paths";
import styles from "./Sessions.module.css";

const FREE = "__free__";

/** V2: pick a routine and a cycle day (suggested), or start a free session. */
export default function NewSessionScreen() {
  const t = useT();
  const navigate = useNavigate();
  const today = useToday();
  const { routines, activeSession, catalog } = useData();
  const { open } = useModals();
  const actions = useSessionActions();
  const recent = useRecentSessions(5);

  const active = useMemo(() => routines.filter((r) => r.status === "active"), [routines]);
  const lastRoutineId = recent.data.find((s) => s.routineId && active.some((r) => r.id === s.routineId))?.routineId ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const routineId = picked ?? lastRoutineId ?? active[0]?.id ?? FREE;
  const routine = active.find((r) => r.id === routineId) ?? null;

  const refs = useRoutineSessions(routine?.id ?? null);
  const suggestion = useMemo(() => (routine ? suggestNextDay(routine, refs.data) : null), [routine, refs.data]);
  const [dayPick, setDayPick] = useState<{ routineId: string; index: number } | null>(null);
  const dayIndex = dayPick && dayPick.routineId === routine?.id ? dayPick.index : (suggestion?.suggestedIndex ?? 0);
  const [date, setDate] = useState<DateKey>(today);

  if (activeSession) return <Navigate to={paths.session(activeSession.id)} replace />;

  const typeColor = (typeId: string) => catalog.blockTypes.find((x) => x.id === typeId)?.color ?? null;

  function start() {
    if (routine && routine.cycle[dayIndex]) {
      const id = actions.startFromRoutine(routine, dayIndex, date);
      navigate(paths.session(id), { replace: true });
    }
  }

  function startFree() {
    const id = actions.startFree(date);
    // The session screen opens the exercise picker (M1) when it sees ?agregar=1.
    navigate(`${paths.session(id)}?agregar=1`, { replace: true });
  }

  const lastIdx = suggestion?.last?.index ?? null;

  return (
    <>
      <Link to={paths.home} className="back">
        <PrevIcon size={18} />
        {t.nav.home}
      </Link>
      <h1 className="h1">{t.newSession.title}</h1>

      <div className="field">
        <span className="lbl">{t.newSession.routine}</span>
        <div className="chips" role="radiogroup" aria-label={t.newSession.routine}>
          {active.map((r) => (
            <button key={r.id} role="radio" aria-checked={r.id === routineId} className={`chip ${r.id === routineId ? "sel" : ""}`} onClick={() => setPicked(r.id)}>
              {r.name}
            </button>
          ))}
          <button role="radio" aria-checked={routineId === FREE} className={`chip ${routineId === FREE ? "sel" : ""}`} onClick={() => setPicked(FREE)}>
            {t.newSession.free}
          </button>
        </div>
      </div>

      <div className={styles.dateRow}>
        <DateIcon size={18} />
        <span className="grow">
          <span className="lbl">{t.newSession.date}</span> <b>{relativeDate(date, today)}</b>
        </span>
        <button
          className="btn sm"
          onClick={() => open({ type: "pickDate", title: t.newSession.pickDate, initial: date, max: today, onPick: setDate })}
        >
          {t.newSession.changeDate}
        </button>
      </div>

      {routine ? (
        <>
          <section className="card row" style={{ gap: 12 }}>
            <RepeatIcon size={20} className="faint" />
            <p className="muted">
              {suggestion?.last && lastIdx !== null
                ? fmt(t.newSession.lastTime, {
                    day: `${fmt(t.editor.dayN, { n: lastIdx + 1 })} · ${dayName(routine, routine.cycle[lastIdx])}`,
                    when: agoText(suggestion.last.date, today),
                    next: suggestion.suggestedIndex + 1,
                  })
                : t.newSession.firstTime}
            </p>
          </section>
          {routine.cycle.length === 0 ? (
            <Empty
              action={
                <Link className="btn" to={paths.routine(routine.id)}>
                  {t.common.edit}
                </Link>
              }
            >
              {t.newSession.emptyDay}
            </Empty>
          ) : (
            <div className="stack sm" role="radiogroup">
              {routine.cycle.map((d, i) => {
                const last = suggestion?.lastDoneByDay.get(d.id) ?? null;
                const isNext = i === suggestion?.suggestedIndex;
                return (
                  <button
                    key={d.id}
                    role="radio"
                    aria-checked={i === dayIndex}
                    className={`${styles.day} ${isNext ? styles.next : ""} ${i === dayIndex ? styles.picked : ""}`}
                    onClick={() => setDayPick({ routineId: routine.id, index: i })}
                  >
                    <span className={styles.dayN}>{i + 1}</span>
                    <span className="grow">
                      <b>{dayName(routine, d) || "—"}</b>
                      <span className={styles.blks}>
                        {d.blockIds
                          .filter((b) => routine.blocks[b])
                          .map((b) => (
                            <span key={b} className={styles.blk}>
                              <TypeDot color={typeColor(routine.blocks[b].typeId)} />
                              {fmt(t.newSession.blockCount, { name: routine.blocks[b].name, n: routine.blocks[b].exercises.length })}
                            </span>
                          ))}
                      </span>
                    </span>
                    {isNext ? <span className="chip acc">{t.newSession.next}</span> : <span className="muted">{last ? agoText(last, today) : t.newSession.neverDone}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <button className="btn acc full" onClick={start} disabled={!routine.cycle[dayIndex]}>
            <StartIcon size={18} />
            {fmt(t.newSession.startDay, { n: dayIndex + 1 })}
          </button>
        </>
      ) : (
        <>
          {active.length === 0 && (
            <div className="card">
              <Empty
                action={
                  <Link className="btn" to={paths.newRoutine}>
                    {t.newSession.createRoutine}
                  </Link>
                }
              >
                {t.newSession.noRoutines}
              </Empty>
            </div>
          )}
          <button className="btn acc full" onClick={startFree}>
            <StartIcon size={18} />
            {t.newSession.startFree}
          </button>
          <p className="muted" style={{ textAlign: "center" }}>
            {t.newSession.freeHint}
          </p>
        </>
      )}
    </>
  );
}
