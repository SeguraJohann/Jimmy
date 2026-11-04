import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColorKey, DateKey } from "@/types/models";
import { ExercisesIcon, HistoryIcon, NextIcon, ProgressIcon, RoutinesIcon, SettingsIcon, StartIcon } from "@/components/icons";
import { TypeDot } from "@/components/ui/misc";
import { useT, fmt, capitalize } from "@/i18n";
import { useAuth } from "@/features/auth/AuthContext";
import { useData } from "@/features/data/DataContext";
import { useToday } from "@/features/data/ClockContext";
import { useAllAnalytics, useRecentSessions, useRoutineSessions, useSessionsRange } from "@/features/data/hooks";
import { useModals } from "@/features/modals/ModalContext";
import { SessionTimer } from "@/features/sessions/components/SessionTimer";
import { APP_CONFIG } from "@/config/app.config";
import { addDays, monthKey, startOfWeek } from "@/lib/date/dateKey";
import { formatDuration, longDate, relativeDate } from "@/lib/date/format";
import { sessionsFromLogs, recentRecords } from "@/lib/metrics/aggregate";
import { dayName, suggestNextDay } from "@/lib/routine/routine";
import { sessionDurationMin, sessionSummary } from "@/lib/session/session";
import { sessionTitle } from "@/lib/session/format";
import { colorVar } from "@/styles/semantic";
import { paths } from "@/routes/paths";
import styles from "./Home.module.css";

/** V1: start / continue, shortcuts, last session and this week. */
export function HomeScreen() {
  const t = useT();
  const today = useToday();
  const { user } = useAuth();
  const { activeSession, routinesById, routines, exercises, logs } = useData();
  const all = useAllAnalytics();
  const { open } = useModals();
  const recent = useRecentSessions(5);

  const lastDone = recent.data.find((s) => s.status === "done") ?? null;
  const lastRoutine = useMemo(() => {
    const s = recent.data.find((x) => x.routineId && routinesById.get(x.routineId)?.status === "active");
    return s?.routineId ? (routinesById.get(s.routineId) ?? null) : null;
  }, [recent.data, routinesById]);
  const refs = useRoutineSessions(lastRoutine?.id ?? null);
  const suggestion = lastRoutine && lastRoutine.cycle.length ? suggestNextDay(lastRoutine, refs.data) : null;

  const weekStart = startOfWeek(today);
  const week = useSessionsRange(weekStart, addDays(weekStart, 6));
  const weekColors = useMemo(() => {
    const m = new Map<DateKey, ColorKey[]>();
    for (const s of week.data) {
      const list = m.get(s.date) ?? [];
      for (const r of s.exercises) if (r.blockColor && !list.includes(r.blockColor)) list.push(r.blockColor);
      if (list.length === 0) list.push("amber");
      m.set(s.date, list);
    }
    return m;
  }, [week.data]);

  const monthSessions = useMemo(() => {
    const m = monthKey(today);
    let n = 0;
    for (const s of sessionsFromLogs(logs).values()) if (monthKey(s.date) === m) n++;
    return n;
  }, [logs, today]);
  const records30 = useMemo(() => {
    const byEx = new Map([...all.values()].map((a) => [a.exercise.id, a.points]));
    return recentRecords(byEx, addDays(today, -APP_CONFIG.analytics.recentRecordsDays), 999).length;
  }, [all, today]);

  const firstName = user?.displayName?.split(" ")[0];
  const activeRoutines = routines.filter((r) => r.status === "active").length;

  return (
    <>
      <div className="top">
        <div className="grow">
          <p className="eyebrow">{capitalize(longDate(today, today))}</p>
          <h1 className="h1">{firstName ? fmt(t.home.hello, { name: firstName }) : t.home.helloAnon}</h1>
        </div>
        <button className={`btn sm icon ghost ${styles.settings}`} onClick={() => open({ type: "settings" })} aria-label={t.nav.settings}>
          <SettingsIcon size={20} />
        </button>
      </div>

      <div className={styles.hero}>
        {activeSession ? (
          <Link className={`${styles.tile} ${styles.main}`} to={paths.session(activeSession.id)}>
            <StartIcon size={28} />
            <span>
              <b>{t.home.continue}</b>
              <span className={styles.sub}>
                {sessionTitle(activeSession)} · <SessionTimer startedAt={activeSession.startedAt} small />
              </span>
            </span>
          </Link>
        ) : (
          <Link className={`${styles.tile} ${styles.main}`} to={paths.newSession}>
            <StartIcon size={28} />
            <span>
              <b>{t.home.start}</b>
              <span className={styles.sub}>
                {suggestion && lastRoutine
                  ? fmt(t.home.suggestion, { routine: lastRoutine.name, n: suggestion.suggestedIndex + 1, day: dayName(lastRoutine, lastRoutine.cycle[suggestion.suggestedIndex]) })
                  : t.home.noSuggestion}
              </span>
            </span>
          </Link>
        )}
        <Link className={styles.tile} to={paths.history}>
          <HistoryIcon size={24} className={styles.ic} />
          <span>
            <b>{t.nav.history}</b>
            <span className="muted">{fmt(t.home.historyTile, { n: monthSessions })}</span>
          </span>
        </Link>
        <Link className={styles.tile} to={paths.progress}>
          <ProgressIcon size={24} className={styles.ic} />
          <span>
            <b>{t.nav.progress}</b>
            <span className="muted">{fmt(t.home.progressTile, { n: records30 })}</span>
          </span>
        </Link>
        <Link className={styles.tile} to={paths.exercises}>
          <ExercisesIcon size={24} className={styles.ic} />
          <span>
            <b>{t.nav.exercises}</b>
            <span className="muted">{fmt(t.home.exercisesTile, { n: exercises.filter((e) => !e.archived).length })}</span>
          </span>
        </Link>
        <Link className={styles.tile} to={paths.routines}>
          <RoutinesIcon size={24} className={styles.ic} />
          <span>
            <b>{t.nav.routines}</b>
            <span className="muted">{fmt(t.home.routinesTile, { n: activeRoutines })}</span>
          </span>
        </Link>
      </div>

      <section className="card stack">
        <div className="top">
          <span className="lbl">{t.home.thisWeek}</span>
          <span className="muted">{fmt(t.home.thisWeekCount, { n: week.data.length })}</span>
        </div>
        <div className={styles.week}>
          {t.dates.weekdaysLetter.map((w, i) => {
            const d = addDays(weekStart, i);
            const colors = weekColors.get(d);
            const bg = colors
              ? colors.length === 1
                ? colorVar(colors[0])
                : `linear-gradient(90deg, ${colors
                    .slice(0, 3)
                    .map((c, k, arr) => `${colorVar(c)} ${(k * 100) / arr.length}% ${((k + 1) * 100) / arr.length}%`)
                    .join(", ")})`
              : undefined;
            return (
              <span key={d} className={styles.wd}>
                <span className={`${styles.box} ${d === today ? styles.boxToday : ""} ${d > today ? styles.boxFuture : ""}`} style={bg ? { background: bg } : undefined} />
                <span className="hint">{w}</span>
              </span>
            );
          })}
        </div>
      </section>

      {lastDone ? (
        <Link to={paths.session(lastDone.id)} className="card stack">
          <div className="top">
            <span className="lbl">{t.home.lastSession}</span>
            <span className="lnk">
              {relativeDate(lastDone.date, today)}
              <NextIcon size={16} />
            </span>
          </div>
          <div className="row">
            {lastDone.exercises.find((r) => r.blockColor) && <TypeDot color={lastDone.exercises.find((r) => r.blockColor)?.blockColor} />}
            <b className="grow">{sessionTitle(lastDone)}</b>
          </div>
          <p className="muted">
            {(() => {
              const s = sessionSummary(lastDone);
              return fmt(t.history.summary, { ex: s.exercisesDone, sets: s.sets, min: formatDuration(sessionDurationMin(lastDone)) });
            })()}
          </p>
        </Link>
      ) : (
        !recent.loading && <p className="muted">{t.home.empty}</p>
      )}
    </>
  );
}
