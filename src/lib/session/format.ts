// Text for sets, targets and session titles.

import type { LogSet, LogType, Session, SetEntry, Target } from "@/types/models";
import { es, fmt } from "@/i18n";
import { formatNumber } from "@/lib/utils/number";
import type { Records } from "@/lib/metrics/records";

/** "57,5 × 10" · "12 reps" · "60 s" */
export function formatLogSet(s: LogSet, logType: LogType): string {
  if (logType === "time") return fmt(es.time.seconds, { n: s.s ?? 0 });
  if (logType === "reps" || s.w === null || s.w === 0) return `${s.r ?? 0} ${es.units.reps}`;
  return `${formatNumber(s.w)} × ${s.r ?? 0}`;
}

export function formatSetEntry(s: SetEntry, logType: LogType): string {
  return formatLogSet({ w: s.weight, r: s.reps, s: s.seconds }, logType);
}

/** Compact list "60×10 · 60×10 · 65×8" of the done sets. */
export function setsLine(sets: SetEntry[], logType: LogType): string {
  return sets
    .filter((s) => s.done)
    .map((s) => formatSetEntry(s, logType).replace(" × ", "×"))
    .join(" · ");
}

/** "3 × 10–12 · 60 kg" */
export function formatTarget(t: Target | { sets: number | null; repsMin: number | null; repsMax: number | null; weight: number | null } | null): string | null {
  if (!t) return null;
  const reps =
    t.repsMin !== null && t.repsMax !== null && t.repsMin !== t.repsMax
      ? `${t.repsMin}–${t.repsMax}`
      : t.repsMin !== null
        ? String(t.repsMin)
        : t.repsMax !== null
          ? String(t.repsMax)
          : null;
  const parts: string[] = [];
  if (t.sets !== null && reps) parts.push(`${t.sets} × ${reps}`);
  else if (t.sets !== null) parts.push(`${t.sets} ${t.sets === 1 ? es.units.set1 : es.units.sets}`);
  else if (reps) parts.push(`${reps} ${es.units.reps}`);
  if (t.weight !== null) parts.push(`${formatNumber(t.weight)} ${es.common.kg}`);
  return parts.length ? parts.join(" · ") : null;
}

/** "PPL · Día 2 · Push 1" or "Sesión libre". */
export function sessionTitle(s: Pick<Session, "routineName" | "cycleDayNumber" | "dayName">): string {
  if (!s.routineName) return es.session.free;
  const parts = [s.routineName];
  if (s.cycleDayNumber !== null) parts.push(fmt(es.editor.dayN, { n: s.cycleDayNumber }));
  if (s.dayName) parts.push(s.dayName);
  return parts.join(" · ");
}

/** Pluralized count: "1 serie" / "3 series". */
export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n, 0)} ${n === 1 ? one : many}`;
}

/** Best mark for lists: "57,5 × 10" / "15 reps" / "60 s", or null without history. */
export function bestMark(rec: Records, logType: LogType): string | null {
  if (logType === "time") return rec.bestSeconds ? fmt(es.time.seconds, { n: rec.bestSeconds.value }) : null;
  if (logType === "reps") return rec.bestReps ? `${rec.bestReps.value} ${es.units.reps}` : null;
  if (rec.maxWeight) return `${formatNumber(rec.maxWeight.value)} × ${rec.maxWeight.r ?? 0}`;
  return rec.bestReps ? `${rec.bestReps.value} ${es.units.reps}` : null;
}
