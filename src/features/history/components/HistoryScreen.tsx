import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ColorKey, DateKey, Session } from "@/types/models";
import { NextIcon, PrevIcon } from "@/components/icons";
import { Empty, Loading, Stat, TypeDot } from "@/components/ui/misc";
import { useT, fmt } from "@/i18n";
import { useToday } from "@/features/data/ClockContext";
import { useSessionsRange } from "@/features/data/hooks";
import { addDays, addMonths, endOfMonth, isValidMonthKey, monthKey, parseDateKey, startOfWeek } from "@/lib/date/dateKey";
import { formatDuration, monthYear, relativeDate } from "@/lib/date/format";
import { sessionDurationMin, sessionSummary } from "@/lib/session/session";
import { sessionTitle } from "@/lib/session/format";
import { formatNumber } from "@/lib/utils/number";
import { colorVar } from "@/styles/semantic";
import { paths } from "@/routes/paths";
import styles from "./History.module.css";

/** Unique block colors of a session, in order (free sessions → none). */
function sessionColors(s: Session): ColorKey[] {
  const out: ColorKey[] = [];
  for (const r of s.exercises) if (r.blockColor && !out.includes(r.blockColor)) out.push(r.blockColor);
  return out;
}

/** Cell background: one color, or vertical stripes for several types (max 3). */
function cellBackground(colors: ColorKey[]): string | undefined {
  if (colors.length === 0) return undefined;
  const list = colors.slice(0, 3);
  if (list.length === 1) return colorVar(list[0]);
  const step = 100 / list.length;
  return `linear-gradient(90deg, ${list.map((c, i) => `${colorVar(c)} ${i * step}% ${(i + 1) * step}%`).join(", ")})`;
}

/** V10 (redesigned): month calendar with trained days colored by block type + that month's sessions. */
export default function HistoryScreen() {
  const t = useT();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const raw = params.get("mes");
  const month = raw && isValidMonthKey(raw) ? raw : monthKey(today);
  const first: DateKey = `${month}-01`;
  const last = endOfMonth(first);
  const { data: sessions, loading } = useSessionsRange(first, last);
  const [selected, setSelected] = useState<DateKey | null>(null);

  const go = (delta: number) => {
    setSelected(null);
    setParams({ mes: monthKey(addMonths(first, delta)) });
  };

  const byDay = useMemo(() => {
    const m = new Map<DateKey, Session[]>();
    for (const s of sessions) {
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    return m;
  }, [sessions]);

  // Weeks needed for this month (4–6 rows), Monday first.
  const cells = useMemo(() => {
    const start = startOfWeek(first);
    const end = addDays(startOfWeek(last), 6);
    const out: DateKey[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [first, last]);

  const types = useMemo(() => {
    const map = new Map<string, { name: string; color: ColorKey }>();
    for (const s of sessions) for (const r of s.exercises) if (r.blockTypeId && r.blockColor) map.set(r.blockTypeId, { name: r.blockTypeName ?? "", color: r.blockColor });
    return [...map.values()];
  }, [sessions]);

  const sorted = [...sessions].sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1));
  const listed = selected ? sorted.filter((s) => s.date === selected) : sorted;
  const volume = sessions.reduce((a, s) => a + sessionSummary(s).volume, 0);
  const isCurrentMonth = month === monthKey(today);

  return (
    <>
      <h1 className="h1">{t.history.title}</h1>
      <div className={styles.nav}>
        <button className="btn sm icon" onClick={() => go(-1)} aria-label={t.history.prevMonth}>
          <PrevIcon size={18} />
        </button>
        <span className={styles.month}>{monthYear(first)}</span>
        <button className="btn sm icon" onClick={() => go(1)} aria-label={t.history.nextMonth} disabled={isCurrentMonth}>
          <NextIcon size={18} />
        </button>
        {!isCurrentMonth && (
          <button className="btn sm" onClick={() => setParams({})}>
            {t.history.today}
          </button>
        )}
      </div>

      <section className="card">
        <div className={styles.grid} role="grid" aria-label={monthYear(first)}>
          {t.dates.weekdaysLetter.map((w, i) => (
            <span key={i} className={styles.wd}>
              {w}
            </span>
          ))}
          {cells.map((d) => {
            const inMonth = d >= first && d <= last;
            const list = byDay.get(d) ?? [];
            const has = list.length > 0;
            const colors = list.flatMap(sessionColors);
            const bg = has ? (cellBackground([...new Set(colors)]) ?? "var(--acc)") : undefined;
            const cls = [styles.cell, !inMonth && styles.out, has && styles.has, d === today && styles.today, d === selected && styles.sel, d > today && styles.future].filter(Boolean).join(" ");
            return (
              <button
                key={d}
                className={cls}
                style={bg ? { background: bg } : undefined}
                disabled={!inMonth || !has}
                onClick={() => setSelected((s) => (s === d ? null : d))}
                aria-label={`${parseDateKey(d).d}${has ? ` · ${list.length} ${t.history.sessions}` : ""}`}
              >
                {parseDateKey(d).d}
                {list.length > 1 && <i className={styles.multi}>{list.length}</i>}
              </button>
            );
          })}
        </div>
        {types.length > 0 && (
          <div className={styles.legend}>
            {types.map((ty) => (
              <span key={ty.name}>
                <TypeDot color={ty.color} />
                {ty.name}
              </span>
            ))}
            {sessions.some((s) => sessionColors(s).length === 0) && (
              <span>
                <i className="dot" style={{ background: "var(--acc)" }} />
                {t.history.free}
              </span>
            )}
          </div>
        )}
      </section>

      <div className="stats">
        <Stat value={sessions.length} label={t.history.sessions} />
        <Stat value={byDay.size} label={t.history.activeDays} />
        <Stat value={volume >= 10000 ? `${formatNumber(volume / 1000, 1)}k` : formatNumber(volume, 0)} label={t.history.volume} />
      </div>

      {loading ? (
        <Loading />
      ) : listed.length === 0 ? (
        <div className="card">
          <Empty>{t.history.empty}</Empty>
        </div>
      ) : (
        <div className="card flush">
          {selected && (
            <div className="row" style={{ padding: "10px 16px 0" }}>
              <span className="lbl grow">{relativeDate(selected, today)}</span>
              <button className="lnk" onClick={() => setSelected(null)}>
                {t.history.showAll}
              </button>
            </div>
          )}
          <div className="list">
            {listed.map((s) => {
              const sum = sessionSummary(s);
              const colors = sessionColors(s);
              return (
                <Link key={s.id} to={paths.session(s.id)} className="li">
                  <span className={styles.bar} style={{ background: cellBackground(colors) ?? "var(--acc)" }} />
                  <span className="grow">
                    <b className="ellipsis">{sessionTitle(s)}</b>
                    <span className="muted">
                      {relativeDate(s.date, today)} ·{" "}
                      {fmt(t.history.summary, { ex: sum.exercisesDone, sets: sum.sets, min: formatDuration(sessionDurationMin(s)) })}
                    </span>
                  </span>
                  {s.status === "in_progress" && <span className="chip acc">{t.history.inProgress}</span>}
                  <NextIcon size={18} className="arrow" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
