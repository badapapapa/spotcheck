import { describe, expect, it } from "vitest";
import { rateAsOf } from "@/engine/calendar.ts";
import { loadFx, loadUsd } from "@/engine/__tests__/helpers.ts";
import { convertAmount, convertBetween, roundSignificant } from "../convert.ts";

describe("roundSignificant", () => {
  it("keeps 3 significant figures", () => {
    expect(roundSignificant(393_196_721)).toBe(393_000_000);
    expect(roundSignificant(13_330.4)).toBe(13_300);
    expect(roundSignificant(2_257_411)).toBe(2_260_000);
    expect(roundSignificant(0.5712)).toBe(0.571);
    expect(roundSignificant(15_000)).toBe(15_000);
  });
});

describe("convertAmount", () => {
  // SGD per unit on the same day.
  const USD = 1.27921;
  const VND = 0.00004873;
  const EUR = 1.4395;

  it("keeps the SGD value when switching currency", () => {
    const vnd = convertAmount(15_000, USD, VND);
    expect(vnd).toBe(394_000_000);
    expect(Math.abs((vnd * VND) / (15_000 * USD) - 1)).toBeLessThan(0.005);
    expect(convertAmount(15_000, USD, EUR)).toBe(13_300);
  });

  it("round-trips to about the original amount", () => {
    expect(convertAmount(convertAmount(15_000, USD, VND), VND, USD)).toBe(
      15_000,
    );
  });

  it("never goes below the form's minimum of 1 unit", () => {
    expect(convertAmount(15_000, VND, USD)).toBe(1); // S$0.73 is 0.57 USD
  });
});

describe("convertBetween (the picker's and Hedging's Switch to USD)", () => {
  const jpy = loadFx("JPY");
  const usd = loadUsd();

  it("uses both rates as of the start date, then convertAmount's rounding", () => {
    const r = convertBetween(500_000, jpy, usd, "2026-10-17");
    const a = rateAsOf(jpy, "2026-10-17").value;
    const b = rateAsOf(usd, "2026-10-17").value;
    expect(r.amount).toBe(convertAmount(500_000, a, b));
    // JPY 500,000 is a few thousand US dollars, not 500,000.
    expect(r.amount).toBeGreaterThan(2_000);
    expect(r.amount).toBeLessThan(5_000);
    expect(r.latest).toBe(false);
    expect(r.rateDate <= "2026-10-17").toBe(true);
  });

  it("a start on or after the newest rate converts at the latest rate", () => {
    const r = convertBetween(500_000, jpy, usd, "2099-01-01");
    expect(r.latest).toBe(true);
    expect(r.rateDate).toBe(usd.dates.at(-1));
  });
});
