import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { NextIcon, StartIcon } from "@/components/icons";
import { ChipSelect, Empty, Segmented, Stat, TrendBadge, TypeDot } from "@/components/ui/misc";
import { Sparkline, TimeChart } from "@/components/charts/TimeChart";
import chartStyles from "@/components/charts/charts.module.css";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useToday } from "@/features/data/ClockContext";
import { useAllAnalytics, type ExerciseAnalytics } from "@/features/data/hooks";
import { APP_CONFIG } from "@/config/app.config";
import { firstLogDate, periodRange, periodSummary, recentRecords, volumeBuckets, type Period } from "@/lib/metrics/aggregate";
import { movingAverage, pointsOf, type EntryFilter } from "@/lib/metrics/points";
import { TREND_ORDER, computeTrend, type TrendStatus } from "@/lib/metrics/trend";
import { addDays, diffDays } from "@/lib/date/dateKey";
import { agoText, dayMonth } from "@/lib/date/format";
import { formatLogSet } from "@/lib/session/format";
import { formatNumber, formatPercent } from "@/lib/utils/number";
import { TREND_COLOR } from "@/styles/semantic";
import { paths } from "@/routes/paths";
import styles from "./Progress.module.css";

const ALL = "all";
const STATUSES: TrendStatus[] = ["down", "flat", "up", "inactive", "insufficient"];

/** V9 (redesigned, docs/ANALYTICS.md §4): per-exercise trend first. */
export default function ProgressScreen() {
  const t = useT();
  const today = useToday();
  const { logs, exercisesById, catalog } = useData();
  const all = useAllAnalytics();

  const [period, setPeriod] = useState<Period>("3m");
  const [typeId, setTypeId] = useState<string>(ALL);
  const [group, setGroup] = useState<string>(ALL);
  const [status, setStatus] = useState<TrendStatus | null>(null);

  const filter: EntryFilter = typeId === ALL ? { kind: "all" } : { kind: "type", id: typeId };
  const first = useMemo(() => firstLogDate(logs), [logs]);
  const range = periodRange(period, today, first);
  const summary = useMemo(() => periodSummary(logs, exercisesById, range, filter, period !== "all"), [logs, exercisesById, range.from, range.to, typeId, period]); // eslint-disable-line react-hooks/exhaustive-deps

  // Types with data (for the filter chips).
  const typeOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const l of logs) for (const e of Object.values(l.entries)) if (e.blockTypeId) ids.add(e.blockTypeId);
    return catalog.blockTypes.filter((bt) => ids.has(bt.id));
  }, [logs, catalog.blockTypes]);

  // Per-exercise trend under the type filter (exercises with data in that type).
  const rows = useMemo(() => {
    const out: ExerciseAnalytics[] = [];
    for (const a of all.values()) {
      if (a.exercise.archived && a.points.length === 0) continue;
      if (group !== ALL && a.exercise.muscleGroup !== group) continue;
      if (typeId === ALL) {
        if (a.points.length > 0) out.push(a);
        continue;
      }
      const pts = pointsOf({ exerciseId: a.exercise.id, entries: Object.fromEntries(a.points.map((p) => [p.sessionId, p.entry])) }, a.exercise.logType, filter);
      if (pts.length > 0) out.push({ ...a, points: pts, trend: computeTrend(pts, today) });
    }
    return out.sort((x, y) => TREND_ORDER[x.trend.status] - TREND_ORDER[y.trend.status] || x.exercise.name.localeCompare(y.exercise.name, "es"));
  }, [all, group, typeId, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<TrendStatus, number> = { down: 0, flat: 0, up: 0, inactive: 0, insufficient: 0 };
    for (const r of rows) c[r.trend.status]++;
    return c;
  }, [rows]);
  const visible = status ? rows.filter((r) => r.trend.status === status) : rows;

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const a of all.values()) if (a.points.length) set.add(a.exercise.muscleGroup);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [all]);

  // Weekly (or monthly for long ranges) volume.
  const unit = diffDays(range.from, range.to) > 370 ? "month" : "week";
  const buckets = useMemo(() => volumeBuckets(logs, exercisesById, range, filter, unit), [logs, exercisesById, range.from, range.to, typeId, unit]); // eslint-disable-line react-hooks/exhaustive-deps
  const bucketAvg = movingAverage(
    buckets.map((b) => b.value),
    4,
  );

  const recent = useMemo(() => {
    const byEx = new Map<string, ExerciseAnalytics["points"]>();
    for (const r of rows) byEx.set(r.exercise.id, r.points);
    return recentRecords(byEx, addDays(today, -APP_CONFIG.analytics.recentRecordsDays), APP_CONFIG.analytics.recentRecordsMax);
  }, [rows, today]);

  if (logs.every((l) => Object.keys(l.entries).length === 0)) {
    return (
      <>
        <h1 className="h1">{t.progress.title}</h1>
        <div className="card">
          <Empty
            action={
              <Link to={paths.newSession} className="btn acc">
                <StartIcon size={18} />
                {t.progress.startFirst}
              </Link>
            }
          >
            {t.progress.empty}
          </Empty>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="h1">{t.progress.title}</h1>
      <Segmented
        value={period}
        onChange={setPeriod}
        label={t.progress.period}
        options={(["4w", "3m", "6m", "1y", "all"] as Period[]).map((p) => ({ value: p, label: t.progress.periods[p] }))}
      />
      {typeOptions.length > 0 && (
        <ChipSelect
          scroll
          value={typeId}
          onChange={setTypeId}
          options={[
            { value: ALL, label: t.common.all },
            ...typeOptions.map((bt) => ({
              value: bt.id,
              label: (
                <>
                  <TypeDot color={bt.color} />
                  {bt.name}
                </>
              ),
            })),
          ]}
        />
      )}

      <div className="stats">
        <Stat value={summary.sessions} label={t.progress.sessions} />
        <Stat value={formatNumber(summary.perWeek, 1)} label={t.progress.perWeek} />
        {period === "all" || summary.volumePct === null ? (
          <Stat value={summary.volume >= 10000 ? `${formatNumber(summary.volume / 1000, 0)}k` : formatNumber(summary.volume, 0)} label={t.progress.volumeTotal} />
        ) : (
          <Stat
            value={<span style={{ color: summary.volumePct >= 0 ? "var(--trend-up)" : "var(--trend-down)" }}>{formatPercent(summary.volumePct, 0)}</span>}
            label={t.progress.volumeVs}
          />
        )}
      </div>

      <section className="card flush">
        <div className={styles.head}>
          <span className="lbl">{t.progress.status}</span>
          <div className="chips">
            {STATUSES.filter((s) => counts[s] > 0).map((s) => (
              <button
                key={s}
                className={`chip ${status === s ? "sel" : ""}`}
                style={status === s ? undefined : { color: TREND_COLOR[s] }}
                onClick={() => setStatus((cur) => (cur === s ? null : s))}
              >
                {t.trend[s]} {counts[s]}
              </button>
            ))}
          </div>
          {groups.length > 1 && (
            <ChipSelect
              scroll
              value={group}
              onChange={setGroup}
              label={t.progress.muscle}
              options={[{ value: ALL, label: t.common.all }, ...groups.map((g) => ({ value: g, label: g }))]}
            />
          )}
          <p className="hint">
            {fmt(t.trend.help, { n: APP_CONFIG.analytics.trendMaxSessions, up: formatNumber(APP_CONFIG.analytics.strengthThreshold, 1) })}
          </p>
        </div>
        <div className="list">
          {visible.map((a) => (
            <TrendRow key={a.exercise.id} a={a} today={today} />
          ))}
          {visible.length === 0 && <Empty>{t.progress.statusEmpty}</Empty>}
        </div>
      </section>

      <section className="card stack">
        <span className="lbl">{unit === "week" ? t.progress.weekly : t.progress.monthly}</span>
        {buckets.some((b) => b.value > 0) ? (
          <>
            <TimeChart
              kind="bar"
              points={buckets.map((b) => ({ date: b.start, value: b.value }))}
              average={bucketAvg}
              today={today}
              formatValue={(v) => (v >= 1000 ? `${formatNumber(v / 1000, v >= 10000 ? 0 : 1)}k` : formatNumber(v, 0))}
              label={t.progress.weekly}
              height={200}
            />
            <div className={chartStyles.legend}>
              <span>
                <i className={chartStyles.swBar} />
                {t.progress.volumeTotal}
              </span>
              <span>
                <i className={chartStyles.swAvg} />
                {t.exercise.avgLegend}
              </span>
            </div>
          </>
        ) : (
          <p className="muted">{t.exercise.noData}</p>
        )}
      </section>

      <section className="card stack">
        <span className="lbl">{t.progress.recent}</span>
        {recent.length === 0 && <p className="muted">{t.progress.recentEmpty}</p>}
        {recent.map((r) => {
          const ex = exercisesById.get(r.exerciseId);
          if (!ex) return null;
          const p = r.point;
          const best = ex.logType === "weight_reps" ? { w: p.topWeight, r: p.topWeightReps, s: null } : { w: null, r: p.bestReps, s: p.bestSeconds };
          return (
            <Link key={`${r.exerciseId}-${r.sessionId}`} to={paths.exercise(ex.id)} className="row">
              <span className="chip pr">PR</span>
              <b className="grow ellipsis">{ex.name}</b>
              <span className="num">{formatLogSet(best, ex.logType, ex.weightUnit)}</span>
              <span className="hint">{dayMonth(r.date, today)}</span>
            </Link>
          );
        })}
      </section>
    </>
  );
}

function TrendRow({ a, today }: { a: ExerciseAnalytics; today: string }) {
  const t = useT();
  const { trend, exercise, points } = a;
  const spark = points.slice(-10).map((p) => p.primary ?? 0);
  const details: string[] = [exercise.muscleGroup];
  if (trend.volumeChangePct !== null) details.push(fmt(t.trend.volume, { pct: formatPercent(trend.volumeChangePct, 0) }));
  if (trend.status === "inactive" && trend.lastDate) details.push(fmt(t.trend.lastDone, { when: agoText(trend.lastDate, today) }));
  if (trend.sessionsSinceRecord >= APP_CONFIG.analytics.stalledSessions && trend.status !== "up") details.push(fmt(t.trend.sinceRecord, { n: trend.sessionsSinceRecord }));
  return (
    <Link to={paths.exercise(exercise.id)} className="li">
      <span className="grow">
        <b className="ellipsis">{exercise.name}</b>
        <span className="muted ellipsis" style={{ display: "block" }}>
          {details.join(" · ")}
        </span>
      </span>
      <Sparkline values={spark} color={TREND_COLOR[trend.status]} />
      <span className={styles.badge}>
        <TrendBadge status={trend.status} pct={trend.changePct} compact />
      </span>
      <NextIcon size={16} className="arrow" />
    </Link>
  );
}

