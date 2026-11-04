// Weight units. Everything is stored in kg; pounds only exist at the edges
// (inputs and text) for exercises whose machine is in pounds.

import type { WeightUnit } from "@/types/models";
import { APP_CONFIG } from "@/config/app.config";

export const KG_PER_LB = 0.45359237;

/** Stored kg → number shown in the exercise's unit. */
export function toUnit(kg: number, unit: WeightUnit): number {
  return unit === "lb" ? kg / KG_PER_LB : kg;
}

/** Number typed in the exercise's unit → kg to store. */
export function fromUnit(value: number, unit: WeightUnit): number {
  // Keep enough precision that 50 lb shows back as exactly 50.
  return unit === "lb" ? Math.round(value * KG_PER_LB * 1e9) / 1e9 : value;
}

export function toUnitOrNull(kg: number | null, unit: WeightUnit): number | null {
  return kg === null ? null : toUnit(kg, unit);
}

export function fromUnitOrNull(value: number | null, unit: WeightUnit): number | null {
  return value === null ? null : fromUnit(value, unit);
}

/** −/+ step in kg for an exercise shown in `unit` (5 lb or 2,5 kg). */
export function weightStepKg(unit: WeightUnit): number {
  return fromUnit(APP_CONFIG.weightStep[unit], unit);
}
