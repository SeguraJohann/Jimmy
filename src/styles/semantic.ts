// Semantic mapping TS → CSS tokens (for inline styles that need a variable).
import type { ColorKey } from "@/types/models";
import type { TrendStatus } from "@/lib/metrics/trend";

export function colorVar(color: ColorKey | null | undefined): string {
  return color ? `var(--c-${color})` : "var(--faint)";
}

export const TREND_COLOR: Record<TrendStatus, string> = {
  up: "var(--trend-up)",
  flat: "var(--trend-flat)",
  down: "var(--trend-down)",
  inactive: "var(--trend-none)",
  insufficient: "var(--trend-none)",
};

export const TREND_TINT: Record<TrendStatus, string> = {
  up: "var(--trend-up-t)",
  flat: "var(--trend-flat-t)",
  down: "var(--trend-down-t)",
  inactive: "var(--raise)",
  insufficient: "var(--raise)",
};

export const TREND_SYMBOL: Record<TrendStatus, string> = { up: "▲", flat: "=", down: "▼", inactive: "·", insufficient: "·" };
