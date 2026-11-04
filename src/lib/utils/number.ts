// Numbers in the UI: kilograms with a decimal comma ("57,5"). Input accepts "," or ".".

/** Parses user input. Empty or invalid → null. */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(/\s/g, "").replace(",", ".");
  if (s === "" || s === "." || s === "-") return null;
  if (!/^-?\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Parses a non-negative integer. Empty or invalid → null. */
export function parseInteger(input: string): number | null {
  const n = parseDecimal(input);
  if (n === null || n < 0) return null;
  return Math.round(n);
}

/** 57.5 → "57,5"; 60 → "60"; rounds to `decimals`. */
export function formatNumber(n: number, decimals = 2): string {
  const f = 10 ** decimals;
  const r = Math.round(n * f) / f;
  const [int, dec] = String(Math.abs(r)).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${r < 0 ? "−" : ""}${grouped}${dec ? `,${dec}` : ""}`;
}

/** Value for an input field (no thousands separator). */
export function toInputValue(n: number | null): string {
  if (n === null) return "";
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

/** "+4,2 %" / "−3,1 %" */
export function formatPercent(n: number, decimals = 1): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(n), decimals)} %`;
}

/** Rounds to the nearest step (2.5 kg) avoiding float noise. */
export function roundTo(n: number, step: number): number {
  return Math.round(Math.round(n / step) * step * 100) / 100;
}
