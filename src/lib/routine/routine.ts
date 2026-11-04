// Routine helpers: names, ordering, editing and next-day suggestion (S2).

import type { Block, BlockExercise, CycleDay, DateKey, Millis, Routine } from "@/types/models";
import { shortId } from "@/lib/utils/shortId";

export function orderedBlockIds(routine: Pick<Routine, "blocks">): string[] {
  return Object.entries(routine.blocks)
    .sort((a, b) => a[1].position - b[1].position)
    .map(([id]) => id);
}

/** Custom name, or the names of its blocks joined with " + ". */
export function dayName(routine: Pick<Routine, "blocks">, day: CycleDay): string {
  if (day.name && day.name.trim()) return day.name.trim();
  const names = day.blockIds.map((id) => routine.blocks[id]?.name).filter((n): n is string => !!n);
  return names.join(" + ");
}

export function dayExerciseCount(routine: Pick<Routine, "blocks">, day: CycleDay): number {
  return day.blockIds.reduce((a, id) => a + (routine.blocks[id]?.exercises.length ?? 0), 0);
}

/** Unique exercise ids used by the routine. */
export function routineExerciseIds(routine: Pick<Routine, "blocks">): Set<string> {
  const out = new Set<string>();
  for (const b of Object.values(routine.blocks)) for (const e of b.exercises) out.add(e.exerciseId);
  return out;
}

/** Unique block type ids used by the routine (in block order). */
export function routineTypeIds(routine: Pick<Routine, "blocks">): string[] {
  const out: string[] = [];
  for (const id of orderedBlockIds(routine)) {
    const t = routine.blocks[id].typeId;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

// ---------- editing (pure, returns new objects) ----------

export function moveInArray<T>(arr: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (to < 0 || to >= arr.length) return arr;
  const out = [...arr];
  const [x] = out.splice(index, 1);
  out.splice(to, 0, x);
  return out;
}

export function addBlock(routine: Routine, name: string, typeId: string): { routine: Routine; blockId: string } {
  const blockId = shortId();
  const position = Math.max(0, ...Object.values(routine.blocks).map((b) => b.position)) + 1;
  return { routine: { ...routine, blocks: { ...routine.blocks, [blockId]: { name, typeId, position, exercises: [] } } }, blockId };
}

export function updateBlock(routine: Routine, blockId: string, patch: Partial<Block>): Routine {
  const cur = routine.blocks[blockId];
  if (!cur) return routine;
  return { ...routine, blocks: { ...routine.blocks, [blockId]: { ...cur, ...patch } } };
}

/** Removes a block and its references in the cycle days. */
export function removeBlock(routine: Routine, blockId: string): Routine {
  const blocks = { ...routine.blocks };
  delete blocks[blockId];
  return { ...routine, blocks, cycle: routine.cycle.map((d) => ({ ...d, blockIds: d.blockIds.filter((id) => id !== blockId) })) };
}

export function moveBlock(routine: Routine, blockId: string, delta: number): Routine {
  const ids = moveInArray(orderedBlockIds(routine), orderedBlockIds(routine).indexOf(blockId), delta);
  const blocks: Record<string, Block> = {};
  ids.forEach((id, i) => (blocks[id] = { ...routine.blocks[id], position: i + 1 }));
  return { ...routine, blocks };
}

export function daysUsingBlock(routine: Routine, blockId: string): number[] {
  return routine.cycle.map((d, i) => (d.blockIds.includes(blockId) ? i + 1 : 0)).filter((n) => n > 0);
}

export function newBlockExercise(exerciseId: string): BlockExercise {
  return { id: shortId(), exerciseId, targetSets: null, targetRepsMin: null, targetRepsMax: null, targetWeight: null, note: null };
}

export function newCycleDay(blockIds: string[] = []): CycleDay {
  return { id: shortId(), name: null, blockIds };
}

/** Copy with fresh block/day/row ids; sessions keep pointing at the original. */
export function duplicateRoutine(routine: Routine, name: string): Omit<Routine, "id" | "createdAt" | "updatedAt"> {
  const map = new Map<string, string>();
  const blocks: Record<string, Block> = {};
  for (const [id, b] of Object.entries(routine.blocks)) {
    const nid = shortId();
    map.set(id, nid);
    blocks[nid] = { ...b, exercises: b.exercises.map((e) => ({ ...e, id: shortId() })) };
  }
  return {
    name,
    description: routine.description,
    status: "active",
    blocks,
    cycle: routine.cycle.map((d) => ({ ...d, id: shortId(), blockIds: d.blockIds.map((id) => map.get(id) ?? id) })),
  };
}

// ---------- next day suggestion ----------

export interface RoutineSessionRef {
  cycleDayId: string | null;
  cycleDayNumber: number | null;
  date: DateKey;
  startedAt: Millis;
}

export interface DaySuggestion {
  /** Index in routine.cycle of the suggested day. */
  suggestedIndex: number;
  /** Last session done with this routine, if any. */
  last: { index: number | null; date: DateKey } | null;
  /** Last date each cycle day was done. */
  lastDoneByDay: Map<string, DateKey>;
}

function indexOfSession(routine: Routine, s: RoutineSessionRef): number | null {
  const byId = routine.cycle.findIndex((d) => d.id === s.cycleDayId);
  if (byId >= 0) return byId;
  return null;
}

/** Last day done + 1, wrapping to day 1; day 1 without history (spec §2.3). */
export function suggestNextDay(routine: Routine, sessions: RoutineSessionRef[]): DaySuggestion {
  const lastDoneByDay = new Map<string, DateKey>();
  let last: RoutineSessionRef | null = null;
  for (const s of sessions) {
    if (s.cycleDayId) {
      const cur = lastDoneByDay.get(s.cycleDayId);
      if (!cur || s.date > cur) lastDoneByDay.set(s.cycleDayId, s.date);
    }
    if (!last || s.date > last.date || (s.date === last.date && s.startedAt > last.startedAt)) last = s;
  }
  const n = routine.cycle.length;
  if (!last || n === 0) return { suggestedIndex: 0, last: last ? { index: null, date: last.date } : null, lastDoneByDay };
  const idx = indexOfSession(routine, last);
  return {
    suggestedIndex: idx === null ? 0 : (idx + 1) % n,
    last: { index: idx, date: last.date },
    lastDoneByDay,
  };
}
