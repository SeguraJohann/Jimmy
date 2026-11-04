import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AddIcon, NextIcon } from "@/components/icons";
import { Empty, TypeDot } from "@/components/ui/misc";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useRecentSessions } from "@/features/data/hooks";
import { routineExerciseIds, routineTypeIds } from "@/lib/routine/routine";
import { plural } from "@/lib/session/format";
import { paths } from "@/routes/paths";

/** V5: routines (active / archived). */
export default function RoutinesScreen() {
  const t = useT();
  const { routines, catalog } = useData();
  const recent = useRecentSessions(5);
  const [archived, setArchived] = useState(false);

  const inUseId = useMemo(() => recent.data.find((s) => s.routineId)?.routineId ?? null, [recent.data]);
  const activeCount = routines.filter((r) => r.status === "active").length;
  const archivedCount = routines.length - activeCount;
  const list = routines.filter((r) => (r.status === "archived") === archived);

  return (
    <>
      <div className="top">
        <h1 className="h1">{t.routines.title}</h1>
        <Link className="btn acc sm" to={paths.newRoutine}>
          <AddIcon size={16} />
          {t.routines.new}
        </Link>
      </div>
      {routines.length === 0 ? (
        <div className="card">
          <Empty
            action={
              <Link className="btn acc" to={paths.newRoutine}>
                {t.routines.createFirst}
              </Link>
            }
          >
            {t.routines.empty}
          </Empty>
        </div>
      ) : (
        <>
          <div className="chips">
            <button className={`chip ${!archived ? "sel" : ""}`} onClick={() => setArchived(false)}>
              {t.routines.active} {activeCount}
            </button>
            <button className={`chip ${archived ? "sel" : ""}`} onClick={() => setArchived(true)}>
              {t.routines.archived} {archivedCount}
            </button>
          </div>
          <div className="card flush">
            <div className="list">
              {list.map((r) => {
                const types = routineTypeIds(r).map((id) => catalog.blockTypes.find((x) => x.id === id)).filter((x) => !!x);
                return (
                  <Link key={r.id} to={paths.routine(r.id)} className="li">
                    <span className="grow">
                      <b className="ellipsis">{r.name}</b>
                      <span className="muted">
                        {fmt(t.routines.meta, {
                          days: plural(r.cycle.length, t.units.day1, t.units.days),
                          blocks: plural(Object.keys(r.blocks).length, t.units.block1, t.units.blocks),
                          ex: plural(routineExerciseIds(r).size, t.units.exercise1, t.units.exercises),
                        })}
                      </span>
                      {types.length > 0 && (
                        <span className="row" style={{ gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                          {types.map((ty) => (
                            <span key={ty.id} className="row muted" style={{ gap: 6, fontSize: 13 }}>
                              <TypeDot color={ty.color} />
                              {ty.name}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    {r.id === inUseId && <span className="chip ok">{t.routines.inUse}</span>}
                    <NextIcon size={18} className="arrow" />
                  </Link>
                );
              })}
              {list.length === 0 && <Empty>{archived ? t.routines.emptyArchived : t.routines.empty}</Empty>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
