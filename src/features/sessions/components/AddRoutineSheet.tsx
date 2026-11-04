import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Empty, Loading } from "@/components/ui/misc";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useRoutineSessions, useSession } from "@/features/data/hooks";
import { useSessionActions } from "../useSessionActions";
import { suggestNextDay } from "@/lib/routine/routine";
import { sessionParts } from "@/lib/session/session";
import { toast } from "@/lib/utils/toast";
import { CycleDayList } from "./CycleDayList";

/**
 * Adds a day of another routine to the session in progress (combined session):
 * its exercises join the list and can be done in any order.
 */
export function AddRoutineSheet({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const t = useT();
  const { routines } = useData();
  const actions = useSessionActions();
  const { data: session, loading } = useSession(sessionId);

  const active = useMemo(() => routines.filter((r) => r.status === "active" && r.cycle.length > 0), [routines]);
  const inSession = useMemo(() => (session ? sessionParts(session) : []), [session]);
  const taken = useMemo(() => new Set(inSession.map((p) => p.cycleDayId)), [inSession]);
  // Default: the first routine not yet in the session.
  const [picked, setPicked] = useState<string | null>(null);
  const routine = active.find((r) => r.id === picked) ?? active.find((r) => !inSession.some((p) => p.routineId === r.id)) ?? active[0] ?? null;

  const refs = useRoutineSessions(routine?.id ?? null);
  const suggestion = useMemo(() => (routine ? suggestNextDay(routine, refs.data) : null), [routine, refs.data]);
  const [dayPick, setDayPick] = useState<{ routineId: string; index: number } | null>(null);
  const firstFree = routine ? routine.cycle.findIndex((d) => !taken.has(d.id)) : -1;
  const suggested = suggestion && routine && !taken.has(routine.cycle[suggestion.suggestedIndex]?.id) ? suggestion.suggestedIndex : firstFree;
  const dayIndex = dayPick && dayPick.routineId === routine?.id ? dayPick.index : suggested;

  function add() {
    if (!session || !routine || dayIndex < 0) return;
    const res = actions.addRoutineDay(session, routine, dayIndex);
    if ("error" in res) {
      toast(res.error === "sameDay" ? t.addRoutine.sameDay : t.newSession.emptyDay);
      return;
    }
    onClose();
    toast(fmt(t.addRoutine.added, { n: res.added }) + (res.skipped.length ? ` ${fmt(t.addRoutine.skipped, { names: res.skipped.join(", ") })}` : ""));
  }

  return (
    <Sheet
      title={t.addRoutine.title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button className="btn acc" onClick={add} disabled={!routine || dayIndex < 0}>
            {fmt(t.addRoutine.add, { n: dayIndex + 1 })}
          </button>
        </>
      }
    >
      {loading ? (
        <Loading />
      ) : active.length === 0 ? (
        <Empty>{t.addRoutine.none}</Empty>
      ) : (
        <>
          <p className="muted">{t.addRoutine.hint}</p>
          <div className="field">
            <span className="lbl">{t.newSession.routine}</span>
            <div className="chips" role="radiogroup" aria-label={t.newSession.routine}>
              {active.map((r) => (
                <button key={r.id} role="radio" aria-checked={r.id === routine?.id} className={`chip ${r.id === routine?.id ? "sel" : ""}`} onClick={() => setPicked(r.id)}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>
          {routine && <CycleDayList routine={routine} suggestion={suggestion} selected={dayIndex} onPick={(i) => setDayPick({ routineId: routine.id, index: i })} takenDayIds={taken} />}
        </>
      )}
    </Sheet>
  );
}
