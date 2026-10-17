import { describe, expect, it } from "vitest";
import { CURRENCIES, findCurrency, fxFileName } from "../currencies.ts";

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
