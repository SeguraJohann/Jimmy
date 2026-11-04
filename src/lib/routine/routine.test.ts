import { describe, expect, it } from "vitest";
import type { Routine } from "@/types/models";
import { dayName, duplicateRoutine, moveBlock, orderedBlockIds, removeBlock, suggestNextDay, type RoutineSessionRef } from "./routine";

const block = (name: string, typeId: string, position: number) => ({ name, typeId, position, exercises: [] });

// Scenario 1: PPL of 4 days with 6 blocks.
const ppl: Routine = {
  id: "r1",
  name: "PPL 4 días",
  description: null,
  status: "active",
  blocks: {
    pull1: block("Pull 1", "pull", 1),
    leg1: block("Leg 1", "leg", 2),
    push1: block("Push 1", "push", 3),
    pull2: block("Pull 2", "pull", 4),
    leg2: block("Leg 2", "leg", 5),
    push2: block("Push 2", "push", 6),
  },
  cycle: [
    { id: "d1", name: null, blockIds: ["pull1", "leg1"] },
    { id: "d2", name: null, blockIds: ["push1"] },
    { id: "d3", name: null, blockIds: ["pull2", "leg2"] },
    { id: "d4", name: null, blockIds: ["push2"] },
  ],
  createdAt: 0,
  updatedAt: 0,
};

const ref = (dayId: string, date: string, startedAt = 0): RoutineSessionRef => ({ cycleDayId: dayId, cycleDayNumber: null, date, startedAt });

describe("routine structure", () => {
  it("scenario 1: 6 blocks and 4 days, automatic day names", () => {
    expect(Object.keys(ppl.blocks)).toHaveLength(6);
    expect(ppl.cycle).toHaveLength(4);
    expect(dayName(ppl, ppl.cycle[0])).toBe("Pull 1 + Leg 1");
    expect(dayName(ppl, { id: "x", name: " Torso ", blockIds: ["pull1"] })).toBe("Torso");
  });
  it("scenario 3: a day can reuse existing blocks", () => {
    const r: Routine = { ...ppl, cycle: [...ppl.cycle, { id: "d5", name: null, blockIds: ["push1", "pull1"] }] };
    expect(dayName(r, r.cycle[4])).toBe("Push 1 + Pull 1");
  });
  it("removing a block removes it from the days", () => {
    const r = removeBlock(ppl, "leg1");
    expect(r.cycle[0].blockIds).toEqual(["pull1"]);
    expect(r.blocks.leg1).toBeUndefined();
  });
  it("moves blocks", () => {
    expect(orderedBlockIds(moveBlock(ppl, "leg1", -1)).slice(0, 2)).toEqual(["leg1", "pull1"]);
  });
  it("duplicates with fresh ids and remapped days", () => {
    const d = duplicateRoutine(ppl, "PPL (copia)");
    const ids = Object.keys(d.blocks);
    expect(ids).toHaveLength(6);
    expect(ids.some((id) => id in ppl.blocks)).toBe(false);
    for (const day of d.cycle) for (const b of day.blockIds) expect(ids).toContain(b);
  });
});

describe("suggestNextDay", () => {
  it("no sessions → day 1", () => {
    expect(suggestNextDay(ppl, []).suggestedIndex).toBe(0);
  });
  it("scenario 4: last was D2 → D3", () => {
    expect(suggestNextDay(ppl, [ref("d1", "2026-10-28"), ref("d2", "2026-10-30")]).suggestedIndex).toBe(2);
  });
  it("scenario 5: picked D4 instead → next is D1", () => {
    expect(suggestNextDay(ppl, [ref("d2", "2026-10-30"), ref("d4", "2026-11-01")]).suggestedIndex).toBe(0);
  });
  it("scenario 6: last day of the cycle wraps to D1", () => {
    expect(suggestNextDay(ppl, [ref("d4", "2026-11-01")]).suggestedIndex).toBe(0);
  });
  it("scenario 2: a single-day routine always suggests that day", () => {
    const one: Routine = { ...ppl, cycle: [{ id: "only", name: null, blockIds: ["pull1"] }] };
    expect(suggestNextDay(one, [ref("only", "2026-11-01")]).suggestedIndex).toBe(0);
  });
  it("uses date, then start time, regardless of input order", () => {
    const s = suggestNextDay(ppl, [ref("d3", "2026-11-01", 2), ref("d1", "2026-11-01", 1), ref("d2", "2026-10-01")]);
    expect(s.suggestedIndex).toBe(3);
    expect(s.lastDoneByDay.get("d2")).toBe("2026-10-01");
  });
  it("a deleted day falls back to day 1", () => {
    expect(suggestNextDay(ppl, [ref("gone", "2026-11-01")]).suggestedIndex).toBe(0);
  });
});
