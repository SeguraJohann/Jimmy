import { describe, expect, it } from "vitest";
import { formatNumber, formatPercent, parseDecimal, parseInteger, roundTo, toInputValue } from "./number";

describe("numbers with decimal comma (G2)", () => {
  it("parses comma or dot", () => {
    expect(parseDecimal("57,5")).toBe(57.5);
    expect(parseDecimal("57.5")).toBe(57.5);
    expect(parseDecimal(" 60 ")).toBe(60);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseInteger("10")).toBe(10);
    expect(parseInteger("-3")).toBeNull();
  });
  it("formats", () => {
    expect(formatNumber(57.5)).toBe("57,5");
    expect(formatNumber(4320)).toBe("4.320");
    expect(formatNumber(76.666, 1)).toBe("76,7");
    expect(toInputValue(57.5)).toBe("57,5");
    expect(toInputValue(null)).toBe("");
    expect(formatPercent(4.21)).toBe("+4,2 %");
    expect(formatPercent(-3.14)).toBe("−3,1 %");
    expect(roundTo(57.4999, 2.5)).toBe(57.5);
  });
});

describe("weight units", async () => {
  const { fromUnit, toUnit, weightStepKg } = await import("./units");
  const { formatNumber: f } = await import("./number");
  it("round-trips pounds without visible drift", () => {
    for (const lb of [5, 45, 50, 87.5, 135, 300]) expect(f(toUnit(fromUnit(lb, "lb"), "lb"))).toBe(f(lb));
  });
  it("kg is the identity", () => {
    expect(fromUnit(57.5, "kg")).toBe(57.5);
    expect(toUnit(57.5, "kg")).toBe(57.5);
  });
  it("step is 5 lb or 2,5 kg", () => {
    expect(weightStepKg("kg")).toBe(2.5);
    expect(toUnit(weightStepKg("lb"), "lb")).toBeCloseTo(5, 6);
  });
});
