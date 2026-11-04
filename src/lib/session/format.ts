// Text for sets, targets and session titles.

import type { LogSet, LogType, Session, SetEntry, Target, WeightUnit } from "@/types/models";
import { es, fmt } from "@/i18n";
import { formatNumber } from "@/lib/utils/number";
import type { Records } from "@/lib/metrics/records";
import { toUnit } from "@/lib/utils/units";

/** Weight in the exercise's unit: "57,5" (kg is implied) or "110 lb". */
export function formatWeight(kg: number, unit: WeightUnit = "kg", decimals?: number): string {
  const n = formatNumber(toUnit(kg, unit), decimals);
  return unit === "lb" ? `${n} ${es.common.lb}` : n;
}

/** Weight with its unit always visible: "57,5 kg" / "110 lb". */
export function formatWeightUnit(kg: number, unit: WeightUnit = "kg", decimals?: number): string {
  return `${formatNumber(toUnit(kg, unit), decimals)} ${unit === "lb" ? es.common.lb : es.common.kg}`;
}

/** "57,5 × 10" · "110 lb × 10" · "12 reps" · "60 s" */
export function formatLogSet(s: LogSet, logType: LogType, unit: WeightUnit = "kg"): string {
  if (logType === "time") return fmt(es.time.seconds, { n: s.s ?? 0 });
  if (logType === "reps" || s.w === null || s.w === 0) return `${s.r ?? 0} ${es.units.reps}`;
  return `${formatWeight(s.w, unit)} × ${s.r ?? 0}`;
}

export function formatSetEntry(s: SetEntry, logType: LogType, unit: WeightUnit = "kg"): string {
  return formatLogSet({ w: s.weight, r: s.reps, s: s.seconds }, logType, unit);
}

/** Compact list "60×10 · 60×10 · 65×8" of the done sets ("… lb" once at the end for pounds). */
export function setsLine(sets: SetEntry[], logType: LogType, unit: WeightUnit = "kg"): string {
  const done = sets.filter((s) => s.done);
  const line = done.map((s) => formatLogSet({ w: s.weight === null ? null : toUnit(s.weight, unit), r: s.reps, s: s.seconds }, logType).replace(" × ", "×")).join(" · ");
  const hasWeight = logType === "weight_reps" && done.some((s) => s.weight);
  return unit === "lb" && hasWeight ? `${line} ${es.common.lb}` : line;
}

/** "3 × 10–12 · 60 kg" */
export function formatTarget(t: Target | { sets: number | null; repsMin: number | null; repsMax: number | null; weight: number | null } | null, unit: WeightUnit = "kg"): string | null {
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
  if (t.weight !== null) parts.push(formatWeightUnit(t.weight, unit));
  return parts.length ? parts.join(" · ") : null;
}

/** "PPL · Día 2 · Push 1" or "Sesión libre". */
export function sessionTitle(s: Pick<Session, "routineName" | "cycleDayNumber" | "dayName"> & { extraParts?: Session["extraParts"] }): string {
  if (!s.routineName) return es.session.free;
  const one = (routineName: string, n: number | null, day: string | null) => {
    const parts = [routineName];
    if (n !== null) parts.push(fmt(es.editor.dayN, { n }));
    if (day) parts.push(day);
    return parts.join(" · ");
  };
  return [one(s.routineName, s.cycleDayNumber, s.dayName), ...(s.extraParts ?? []).map((p) => one(p.routineName, p.cycleDayNumber, p.dayName))].join(" + ");
}

/** Pluralized count: "1 serie" / "3 series". */
export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n, 0)} ${n === 1 ? one : many}`;
}

/** Best mark for lists: "57,5 × 10" / "15 reps" / "60 s", or null without history. */
export function bestMark(rec: Records, logType: LogType, unit: WeightUnit = "kg"): string | null {
  if (logType === "time") return rec.bestSeconds ? fmt(es.time.seconds, { n: rec.bestSeconds.value }) : null;
  if (logType === "reps") return rec.bestReps ? `${rec.bestReps.value} ${es.units.reps}` : null;
  if (rec.maxWeight) return `${formatWeight(rec.maxWeight.value, unit)} × ${rec.maxWeight.r ?? 0}`;
  return rec.bestReps ? `${rec.bestReps.value} ${es.units.reps}` : null;
}
