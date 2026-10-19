import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  findCurrency,
  fxFileName,
  fxSourceLabel,
} from "../currencies.ts";

describe("currencies", () => {
  it("lists the 40 exchange currencies once each", () => {
    expect(CURRENCIES).toHaveLength(40);
    expect(new Set(CURRENCIES.map((c) => c.code)).size).toBe(40);
    expect(CURRENCIES.map((c) => c.code)).not.toContain("SGD");
  });

  it("only USD has interest-rate data (forwards and options) in the MVP", () => {
    expect(CURRENCIES.filter((c) => c.rateSeries).map((c) => c.code)).toEqual([
      "USD",
    ]);
  });

  it("flags BND as pegged to SGD", () => {
    expect(findCurrency("BND")?.peggedToSgd).toBe(true);
    expect(findCurrency("XYZ")).toBeUndefined();
    expect(fxFileName("EUR")).toBe("fx/SGD-EUR.json");
  });
});

describe("fxSourceLabel", () => {
  it("says 'derived via EUR' only for ECB crosses, not for EUR itself", () => {
    expect(fxSourceLabel(findCurrency("EUR")!)).toBe(
      "Source: ECB euro reference rate.",
    );
    expect(fxSourceLabel(findCurrency("USD")!)).toBe(
      "Source: ECB euro reference rates (SGD cross derived via EUR).",
    );
    expect(fxSourceLabel(findCurrency("VND")!)).toMatch(
      /blended rates; daily volatility may be understated/,
    );
    expect(fxSourceLabel(findCurrency("BND")!)).toMatch(/peg/);
  });
});
