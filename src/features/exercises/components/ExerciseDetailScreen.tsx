import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ColorKey, DateKey, LogType } from "@/types/models";
import { ArchiveIcon, DeleteIcon, EditIcon, NextIcon, PrevIcon, UnarchiveIcon } from "@/components/icons";
import { ChipSelect, Empty, Segmented, Stat, TrendBadge, TypeDot } from "@/components/ui/misc";
import { TimeChart } from "@/components/charts/TimeChart";
import chartStyles from "@/components/charts/charts.module.css";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useToday } from "@/features/data/ClockContext";
import { useExerciseAnalytics } from "@/features/data/hooks";
import { useModals } from "@/features/modals/ModalContext";
import { useExerciseActions } from "../useExerciseActions";
import { APP_CONFIG } from "@/config/app.config";
import { movingAverage, type EntryFilter, type SessionPoint } from "@/lib/metrics/points";
import { primaryRecordSessions } from "@/lib/metrics/records";
import { compareLastN } from "@/lib/metrics/trend";
import { chartSeries, periodRange, type Period } from "@/lib/metrics/aggregate";
import { formatLogSet, plural } from "@/lib/session/format";
import { formatNumber, formatPercent } from "@/lib/utils/number";
import { agoText, dayMonth, relativeDate } from "@/lib/date/format";
import { orderedBlockIds } from "@/lib/routine/routine";
import { paths } from "@/routes/paths";
import styles from "./Exercises.module.css";

type ChartPeriod = Exclude<Period, "4w">;

function parseFilter(v: string): EntryFilter {
  const [kind, id] = v.split(":");
  if ((kind === "type" || kind === "block" || kind === "routine") && id) return { kind, id };
  return { kind: "all" };
}

function pctText(p: number | null): string {
  return p === null ? "—" : formatPercent(p);
}

/** V8 (redesigned, docs/ANALYTICS.md §5). */
export default function ExerciseDetailScreen() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const today = useToday();
  const { exercisesById, logsById, catalog, routines, activeSession } = useData();
  const { open } = useModals();
  const actions = useExerciseActions();
  const exercise = id ? exercisesById.get(id) : undefined;
  const log = id ? logsById.get(id) : undefined;

  const [filterValue, setFilterValue] = useState("all");
  const [period, setPeriod] = useState<ChartPeriod>("6m");
  const [strengthMetric, setStrengthMetric] = useState<"e1rm" | "weight">("e1rm");
  const [pageCount, setPageCount] = useState(1);

  const filter = useMemo(() => parseFilter(filterValue), [filterValue]);
  const analytics = useExerciseAnalytics(id, filter);

  // Filter options: only types / blocks / routines that have data for this exercise.
  const filterOptions = useMemo(() => {
    const types = new Map<string, string>();
    const blocks = new Map<string, string>();
    const rts = new Map<string, string>();
    for (const e of Object.values(log?.entries ?? {})) {
      if (e.blockTypeId) types.set(e.blockTypeId, catalog.blockTypes.find((x) => x.id === e.blockTypeId)?.name ?? e.blockTypeId);
      if (e.blockId && e.blockName) blocks.set(e.blockId, e.blockName);
      if (e.routineId && e.routineName) rts.set(e.routineId, e.routineName);
    }
    const out: { value: string; label: string }[] = [{ value: "all", label: t.exercise.general }];
    for (const [k, v] of types) out.push({ value: `type:${k}`, label: fmt(t.exercise.onlyType, { name: v }) });
    if (blocks.size > 1 || types.size > 1) for (const [k, v] of blocks) out.push({ value: `block:${k}`, label: fmt(t.exercise.onlyBlock, { name: v }) });
    if (rts.size > 1) for (const [k, v] of rts) out.push({ value: `routine:${k}`, label: fmt(t.exercise.onlyRoutine, { name: v }) });
    return out;
  }, [log, catalog.blockTypes, t]);

  const usedIn = useMemo(() => {
    if (!id) return [];
    const out: { routineId: string; routine: string; block: string; days: string[]; color: ColorKey | null }[] = [];
    for (const r of routines) {
      if (r.status !== "active") continue;
      for (const bid of orderedBlockIds(r)) {
        const b = r.blocks[bid];
        if (!b.exercises.some((e) => e.exerciseId === id)) continue;
        const days = r.cycle.map((d, i) => (d.blockIds.includes(bid) ? `${i + 1}` : null)).filter((x): x is string => !!x);
        out.push({ routineId: r.id, routine: r.name, block: b.name, days: days.map((d) => fmt(t.editor.dayN, { n: d })), color: catalog.blockTypes.find((bt) => bt.id === b.typeId)?.color ?? null });
      }
    }
    return out;
  }, [routines, id, t, catalog.blockTypes]);

  if (!exercise || !analytics) {
    return (
      <>
        <Link to={paths.exercises} className="back">
          <PrevIcon size={18} />
          {t.exercise.back}
        </Link>
        <Empty>{t.app.notFound}</Empty>
      </>
    );
  }

  const { points, trend, records } = analytics;
  const logType = exercise.logType;
  const totalSessions = Object.keys(log?.entries ?? {}).length;

  // Period window for charts.
  const range = periodRange(period, today, points[0]?.date ?? null);
  const inRange = points.filter((p) => p.date >= range.from);

  const recordSet = primaryRecordSessions(points);
  const strengthPick = (p: SessionPoint): number | null => {
    if (logType === "weight_reps") return strengthMetric === "e1rm" ? (p.e1rm ?? (p.primaryIsFallback ? p.primary : null)) : p.topWeight;
    return p.primary;
  };
  const strength = chartSeries(inRange, strengthPick, "max", APP_CONFIG.analytics.maxChartPoints, recordSet);
  const volume = chartSeries(inRange, (p) => (p.volume > 0 ? p.volume : null), "sum", APP_CONFIG.analytics.maxChartPoints);
  const strengthAvg = movingAverage(
    strength.series.map((p) => p.value),
    APP_CONFIG.analytics.movingAverage,
  );
  const volumeAvg = movingAverage(
    volume.series.map((p) => p.value),
    APP_CONFIG.analytics.movingAverage,
  );
  const chartFrom: DateKey | undefined = period === "all" ? undefined : range.from;
  const anyFallback = logType === "weight_reps" && strengthMetric === "e1rm" && inRange.some((p) => p.primaryIsFallback);

  const comparison = compareLastN(points, 4);
  const history = [...points].reverse();
  const pageSize = APP_CONFIG.analytics.historyPageSize;
  const formatPrimary = (v: number) => formatNumber(v, logType === "weight_reps" ? 1 : 0);

  const hasHistory = totalSessions > 0;
  const inActiveSession = !!activeSession?.exercises.some((r) => r.exerciseId === exercise.id);

  function onArchive() {
    if (!exercise) return;
    if (exercise.archived) {
      actions.setArchived(exercise.id, false);
      return;
    }
    open({
      type: "confirm",
      title: fmt(t.exercises.archiveTitle, { name: exercise.name }),
      lines: [fmt(t.exercises.archiveLines, { n: totalSessions })],
      confirmLabel: t.confirm.archive,
      onConfirm: () => actions.setArchived(exercise.id, true),
    });
  }

  function onDelete() {
    if (!exercise) return;
    const blocks = routines.reduce((a, r) => a + Object.values(r.blocks).filter((b) => b.exercises.some((e) => e.exerciseId === exercise.id)).length, 0);
    open({
      type: "confirm",
      title: fmt(t.exercises.deleteTitle, { name: exercise.name }),
      lines: [t.exercises.deleteLines, ...(blocks ? [fmt(t.exercises.deleteRoutines, { n: blocks })] : [])],
      confirmLabel: t.confirm.delete,
      danger: true,
      onConfirm: () => {
        actions.remove(exercise.id);
        navigate(paths.exercises, { replace: true });
      },
    });
  }

  const stats = (() => {
    const last = points.length ? agoText(points[points.length - 1].date, today) : t.dates.never;
    if (logType === "weight_reps") {
      return [
        { v: records.best1RM ? formatNumber(records.best1RM.value, 1) : "—", l: t.exercise.best1RM },
        { v: records.maxWeight ? `${formatNumber(records.maxWeight.value)}×${records.maxWeight.r ?? 0}` : "—", l: t.exercise.bestWeight },
        { v: last, l: t.exercise.lastTime },
      ];
    }
    const best = logType === "reps" ? records.bestReps : records.bestSeconds;
    return [
      { v: best ? formatNumber(best.value, 0) : "—", l: logType === "reps" ? t.exercise.bestReps : t.exercise.bestTime },
      { v: String(points.length), l: t.exercise.sessions },
      { v: last, l: t.exercise.lastTime },
    ];
  })();

  return (
    <>
      <Link to={paths.exercises} className="back">
        <PrevIcon size={18} />
        {t.exercise.back}
      </Link>
      <div className="top">
        <div className="grow">
          <p className="eyebrow">
            {exercise.muscleGroup}
            {exercise.equipment && ` · ${t.equipment[exercise.equipment].toLowerCase()}`}
            {exercise.archived && ` · ${t.exercises.archivedTag}`}
          </p>
          <h1 className="h1">{exercise.name}</h1>
        </div>
        <button className="btn sm" onClick={() => open({ type: "exerciseForm", exerciseId: exercise.id })}>
          <EditIcon size={16} />
          {t.common.edit}
        </button>
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <TrendBadge status={trend.status} pct={trend.changePct} />
        {trend.volumeChangePct !== null && <span className="muted">{fmt(t.trend.volume, { pct: formatPercent(trend.volumeChangePct) })}</span>}
        {trend.sessionsSinceRecord >= APP_CONFIG.analytics.stalledSessions && <span className="muted">· {fmt(t.trend.sinceRecord, { n: trend.sessionsSinceRecord })}</span>}
      </div>
      {exercise.notes && <p className="muted">{exercise.notes}</p>}

      <div className="stats">
        {stats.map((s) => (
          <Stat key={s.l} value={s.v} label={s.l} />
        ))}
      </div>

      {!hasHistory ? (
        <div className="card">
          <Empty>{t.exercise.historyEmpty}</Empty>
        </div>
      ) : (
        <>
          {filterOptions.length > 1 && (
            <div className="field">
              <span className="lbl">{t.exercise.view}</span>
              <ChipSelect scroll value={filterValue} onChange={setFilterValue} options={filterOptions} label={t.exercise.view} />
            </div>
          )}
          <Segmented
            value={period}
            onChange={setPeriod}
            label={t.exercise.period}
            options={(["3m", "6m", "1y", "all"] as ChartPeriod[]).map((p) => ({ value: p, label: t.progress.periods[p] }))}
          />

          <section className="card stack">
            <div className="top">
              <span className="lbl">{logType === "weight_reps" ? t.exercise.strength : logType === "reps" ? t.exercise.strengthReps : t.exercise.strengthTime}</span>
              {logType === "weight_reps" && (
                <Segmented
                  small
                  value={strengthMetric}
                  onChange={setStrengthMetric}
                  options={[
                    { value: "e1rm", label: t.exercise.metric1RM },
                    { value: "weight", label: t.exercise.metricWeight },
                  ]}
                />
              )}
            </div>
            {strength.series.length < 2 ? (
              <p className="muted">{inRange.length === 0 ? t.exercise.noData : t.exercise.notEnough}</p>
            ) : (
              <>
                <TimeChart
                  kind="line"
                  points={strength.series}
                  average={strengthAvg}
                  from={chartFrom}
                  to={today}
                  today={today}
                  formatValue={formatPrimary}
                  label={t.exercise.strength}
                />
                <div className={chartStyles.legend}>
                  <span>
                    <i className={chartStyles.swLine} />
                    {logType !== "weight_reps" ? t.exercise.strength : strengthMetric === "e1rm" ? t.exercise.metric1RM : t.exercise.metricWeight}
                  </span>
                  <span>
                    <i className={chartStyles.swAvg} />
                    {t.exercise.avgLegend}
                  </span>
                  <span>
                    <i className={chartStyles.swRecord} />
                    {t.exercise.recordLegend}
                  </span>
                  {strength.aggregated !== "none" && <span>{strength.aggregated === "week" ? t.exercise.aggregatedWeek : t.exercise.aggregatedMonth}</span>}
                </div>
                {anyFallback && <p className="hint">{t.exercise.fallbackNote}</p>}
              </>
            )}
          </section>

          <section className="card stack">
            <span className="lbl">
              {t.exercise.volume} ({logType === "weight_reps" ? t.exercise.volumeUnitKg : logType === "reps" ? t.exercise.volumeUnitReps : t.exercise.volumeUnitSec})
            </span>
            {volume.series.length < 2 ? (
              <p className="muted">{inRange.length === 0 ? t.exercise.noData : t.exercise.notEnough}</p>
            ) : (
              <>
                <TimeChart
                  kind="bar"
                  points={volume.series}
                  average={volumeAvg}
                  from={chartFrom}
                  to={today}
                  today={today}
                  formatValue={(v) => (v >= 10000 ? `${formatNumber(v / 1000, 0)}k` : formatNumber(v, 0))}
                  label={t.exercise.volume}
                  height={180}
                />
                <div className={chartStyles.legend}>
                  <span>
                    <i className={chartStyles.swBar} />
                    {t.exercise.volume}
                  </span>
                  <span>
                    <i className={chartStyles.swAvg} />
                    {t.exercise.avgLegend}
                  </span>
                </div>
              </>
            )}
          </section>

          {comparison && (
            <section className="card stack">
              <span className="lbl">{fmt(t.exercise.compareTitle, { n: comparison.count })}</span>
              <div className={styles.compare}>
                <span>{logType === "weight_reps" ? t.exercise.compareStrength : logType === "reps" ? t.exercise.comparePrimaryReps : t.exercise.comparePrimaryTime}</span>
                <b>{comparison.previous.primary !== null ? formatPrimary(comparison.previous.primary) : "—"}</b>
                <b>{comparison.recent.primary !== null ? formatPrimary(comparison.recent.primary) : "—"}</b>
                <CompareDelta pct={comparison.primaryPct} />
                <span>{t.exercise.compareVolume}</span>
                <b>{formatNumber(comparison.previous.volume, 0)}</b>
                <b>{formatNumber(comparison.recent.volume, 0)}</b>
                <CompareDelta pct={comparison.volumePct} />
                {logType !== "time" && (
                  <>
                    <span>{t.exercise.compareReps}</span>
                    <b>{comparison.previous.repsPerSet !== null ? formatNumber(comparison.previous.repsPerSet, 1) : "—"}</b>
                    <b>{comparison.recent.repsPerSet !== null ? formatNumber(comparison.recent.repsPerSet, 1) : "—"}</b>
                    <span />
                  </>
                )}
              </div>
            </section>
          )}

          <section className="card stack">
            <span className="lbl">{t.exercise.records}</span>
            {records.maxWeight && (
              <RecordRow label={t.exercise.bestWeight} value={`${formatNumber(records.maxWeight.value)} × ${records.maxWeight.r ?? 0}`} date={records.maxWeight.date} />
            )}
            {records.best1RM && <RecordRow label={t.exercise.best1RM} value={`${formatNumber(records.best1RM.value, 1)} kg`} date={records.best1RM.date} />}
            {logType !== "weight_reps" && records.bestReps && logType === "reps" && <RecordRow label={t.exercise.bestReps} value={`${records.bestReps.value}`} date={records.bestReps.date} />}
            {logType === "time" && records.bestSeconds && <RecordRow label={t.exercise.bestTime} value={fmt(t.time.seconds, { n: records.bestSeconds.value })} date={records.bestSeconds.date} />}
            {records.bestVolume && <RecordRow label={t.exercise.bestVolume} value={formatNumber(records.bestVolume.value, 0)} date={records.bestVolume.date} />}
            {logType === "weight_reps" && records.repsByWeight.length > 0 && (
              <>
                <span className="lbl" style={{ marginTop: 6 }}>
                  {t.exercise.repsByWeight}
                </span>
                <div className={styles.repsTable}>
                  {records.repsByWeight.slice(0, 6).map((x) => (
                    <div key={x.w} className={styles.repsCell}>
                      <b>
                        {formatNumber(x.w)} × {x.r}
                      </b>
                      <span className="hint">{dayMonth(x.date, today)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="card flush">
            <p className="lbl" style={{ padding: "14px 16px 6px" }}>
              {t.exercise.history} · {plural(history.length, t.units.session1, t.units.sessions)}
            </p>
            {history.slice(0, pageCount * pageSize).map((p) => (
              <HistoryRow key={p.sessionId} point={p} logType={logType} today={today} record={recordSet.has(p.sessionId)} />
            ))}
            {history.length > pageCount * pageSize && (
              <button className="btn ghost full" onClick={() => setPageCount((c) => c + 1)}>
                {t.common.seeMore}
              </button>
            )}
          </section>
        </>
      )}

      <section className="card stack">
        <span className="lbl">{t.exercise.usedIn}</span>
        {usedIn.length === 0 && <p className="muted">{t.exercise.notUsed}</p>}
        {usedIn.map((u) => (
          <Link key={`${u.routineId}-${u.block}`} to={paths.routine(u.routineId)} className="row">
            <TypeDot color={u.color} />
            <span className="grow">
              <b>{u.block}</b> <span className="muted">· {u.routine}</span>
              {u.days.length > 0 && <span className="muted"> · {u.days.join(", ")}</span>}
            </span>
            <NextIcon size={16} className="arrow" />
          </Link>
        ))}
      </section>

      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="btn sm" onClick={onArchive}>
          {exercise.archived ? <UnarchiveIcon size={16} /> : <ArchiveIcon size={16} />}
          {exercise.archived ? t.common.unarchive : t.common.archive}
        </button>
        {!hasHistory && !inActiveSession && (
          <button className="btn sm danger" onClick={onDelete}>
            <DeleteIcon size={16} />
            {t.common.delete}
          </button>
        )}
      </div>
    </>
  );
}

function CompareDelta({ pct }: { pct: number | null }) {
  const color = pct === null || Math.abs(pct) < 1 ? "var(--muted)" : pct > 0 ? "var(--trend-up)" : "var(--trend-down)";
  return <b style={{ color }}>{pctText(pct)}</b>;
}

function RecordRow({ label, value, date }: { label: string; value: string; date: DateKey }) {
  const today = useToday();
  return (
    <div className="row">
      <span className="chip pr">PR</span>
      <span className="grow">{label}</span>
      <b className="num" style={{ fontSize: 18 }}>
        {value}
      </b>
      <span className="hint">{dayMonth(date, today)}</span>
    </div>
  );
}

function HistoryRow({ point, logType, today, record }: { point: SessionPoint; logType: LogType; today: DateKey; record: boolean }) {
  const e = point.entry;
  return (
    <Link to={paths.session(point.sessionId)} className={styles.histRow}>
      <span className="grow">
        <b>
          {relativeDate(point.date, today)}
          {e.blockName && <span className="muted"> · {e.blockName}</span>}
        </b>
        <span className={styles.histSets} style={{ display: "block" }}>
          {e.sets.map((s) => formatLogSet(s, logType).replace(" × ", "×")).join(" · ")}
        </span>
      </span>
      {record && <span className="chip pr">PR</span>}
      <NextIcon size={16} className="arrow" />
    </Link>
  );
}

