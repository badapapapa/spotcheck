import { describe, expect, it } from "vitest";
import { invertFrankfurterRate } from "../frankfurter.ts";

describe("invertFrankfurterRate", () => {
  it("maps 0.78015 USD per SGD to 1.28180 SGD per USD (plan §3.8)", () => {
    expect(invertFrankfurterRate(0.78015).toFixed(5)).toBe("1.28180");
  });

  it("is its own inverse to rounding", () => {
    for (const r of [0.00004321, 0.5, 1, 3.1415, 12_345.6]) {
      expect(1 / invertFrankfurterRate(r)).toBeCloseTo(r, 6 - Math.log10(r));
    }
  });

  it("rejects zero, negative and non-finite rates", () => {
    for (const r of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => invertFrankfurterRate(r)).toThrow();
    }
  });
});
