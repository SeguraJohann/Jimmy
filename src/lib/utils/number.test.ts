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
