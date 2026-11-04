import type { Routine } from "@/types/models";
import { TypeDot } from "@/components/ui/misc";
import { useT, fmt } from "@/i18n";
import { useData } from "@/features/data/DataContext";
import { useToday } from "@/features/data/ClockContext";
import { dayName, type DaySuggestion } from "@/lib/routine/routine";
import { agoText } from "@/lib/date/format";
import styles from "./Sessions.module.css";

/** Days of a routine as radio cards, with the suggested one marked (V2 and "add routine"). */
export function CycleDayList({
  routine,
  suggestion,
  selected,
  onPick,
  takenDayIds,
}: {
  routine: Routine;
  suggestion: DaySuggestion | null;
  selected: number;
  onPick: (index: number) => void;
  /** Days already in the session: shown but not selectable. */
  takenDayIds?: Set<string>;
}) {
  const t = useT();
  const today = useToday();
  const { catalog } = useData();
  const typeColor = (typeId: string) => catalog.blockTypes.find((x) => x.id === typeId)?.color ?? null;

  return (
    <div className="stack sm" role="radiogroup">
      {routine.cycle.map((d, i) => {
        const last = suggestion?.lastDoneByDay.get(d.id) ?? null;
        const isNext = i === suggestion?.suggestedIndex;
        const taken = takenDayIds?.has(d.id) ?? false;
        return (
          <button
            key={d.id}
            role="radio"
            aria-checked={i === selected}
            disabled={taken}
            className={`${styles.day} ${isNext && !taken ? styles.next : ""} ${i === selected ? styles.picked : ""}`}
            onClick={() => onPick(i)}
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
            {taken ? (
              <span className="chip">{t.addRoutine.inSession}</span>
            ) : isNext ? (
              <span className="chip acc">{t.newSession.next}</span>
            ) : (
              <span className="muted">{last ? agoText(last, today) : t.newSession.neverDone}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
