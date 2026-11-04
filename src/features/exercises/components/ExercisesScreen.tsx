import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AddIcon, NextIcon, SearchIcon } from "@/components/icons";
import { ChipSelect, Empty } from "@/components/ui/misc";
import { useT } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useAllAnalytics } from "@/features/data/hooks";
import { useModals } from "@/features/modals/ModalContext";
import { matchesSearch } from "@/lib/utils/text";
import { bestMark } from "@/lib/session/format";
import { TREND_COLOR, TREND_SYMBOL } from "@/styles/semantic";
import { paths } from "@/routes/paths";
import styles from "./Exercises.module.css";

const ALL = "__all__";

/** V7: exercises with search, muscle group filter and archived toggle. */
export default function ExercisesScreen() {
  const t = useT();
  const { exercises, catalog } = useData();
  const analytics = useAllAnalytics();
  const { open } = useModals();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(ALL);
  const [archived, setArchived] = useState(false);

  const pool = useMemo(() => exercises.filter((e) => e.archived === archived), [exercises, archived]);
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of pool) counts.set(e.muscleGroup, (counts.get(e.muscleGroup) ?? 0) + 1);
    const order = [...catalog.muscleGroups, ...[...counts.keys()].filter((g) => !catalog.muscleGroups.includes(g))];
    return order.filter((g) => counts.has(g)).map((g) => ({ g, n: counts.get(g)! }));
  }, [pool, catalog.muscleGroups]);

  const list = pool.filter((e) => (group === ALL || e.muscleGroup === group) && matchesSearch(e.name, query));
  const archivedCount = exercises.filter((e) => e.archived).length;

  return (
    <>
      <div className="top">
        <h1 className="h1">{t.exercises.title}</h1>
        <button className="btn acc sm" onClick={() => open({ type: "exerciseForm" })}>
          <AddIcon size={16} />
          {t.exercises.new}
        </button>
      </div>

      {exercises.length === 0 ? (
        <div className="card">
          <Empty
            action={
              <button className="btn acc" onClick={() => open({ type: "exerciseForm" })}>
                {t.exercises.createFirst}
              </button>
            }
          >
            {t.exercises.empty}
          </Empty>
        </div>
      ) : (
        <>
          <div className={styles.search}>
            <SearchIcon size={18} />
            <input className="inp" placeholder={t.exercises.search} aria-label={t.exercises.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <ChipSelect
            scroll
            value={group}
            onChange={setGroup}
            label={t.exercises.group}
            options={[{ value: ALL, label: `${t.common.all} ${pool.length}` }, ...groups.map(({ g, n }) => ({ value: g, label: `${g} ${n}` }))]}
          />
          <div className="card flush">
            <div className="list">
              {list.map((e) => {
                const a = analytics.get(e.id);
                const mark = a ? bestMark(a.records, e.logType) : null;
                const st = a?.trend.status;
                return (
                  <Link key={e.id} to={paths.exercise(e.id)} className="li">
                    <span className="grow">
                      <b className="ellipsis">{e.name}</b>
                      <span className="muted">
                        {e.muscleGroup}
                        {e.equipment && ` · ${t.equipment[e.equipment].toLowerCase()}`}
                      </span>
                    </span>
                    {st && (st === "up" || st === "down" || st === "flat") && (
                      <span style={{ color: TREND_COLOR[st], fontWeight: 700 }} aria-label={t.trend[st]} title={t.trend[st]}>
                        {TREND_SYMBOL[st]}
                      </span>
                    )}
                    <span className={styles.best}>{mark ?? <span className="faint">{t.exercises.noHistory}</span>}</span>
                    <NextIcon size={18} className="arrow" />
                  </Link>
                );
              })}
              {list.length === 0 && <Empty>{t.exercises.noResults}</Empty>}
            </div>
          </div>
          {(archivedCount > 0 || archived) && (
            <button className={`chip ${archived ? "sel" : ""}`} style={{ alignSelf: "flex-start" }} onClick={() => setArchived((v) => !v)}>
              {t.exercises.showArchived} {archivedCount}
            </button>
          )}
        </>
      )}
    </>
  );
}
