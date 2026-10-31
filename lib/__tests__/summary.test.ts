import { describe, expect, it } from "vitest";
import { replay } from "@/engine/replay.ts";
import { loadUsd } from "@/engine/__tests__/helpers.ts";
import { describeReplay } from "../summary.ts";
import {
  BANNED_IN_UI_TEXT as ADVISORY,
  STRATEGY_SENTENCE,
  comparesStrategies,
  namesRanking,
} from "@/tests/advisory-patterns.ts";
import { addDays } from "@/engine/calendar.ts";
import { loadFx } from "@/engine/__tests__/helpers.ts";

const scenario = {
  currency: "USD",
  amount: 15_000,
  startDate: "2026-10-17",
  deadline: "2027-08-01",
  tranches: 6,
  spread: 0.005,
};

describe("describeReplay", () => {
  const r = replay(loadUsd(), scenario, { targetBelowSpot: 0.02 });
  const text = describeReplay(r, scenario, 0.02).join(" ");

  it("describes the history with real numbers", () => {
    expect(text).toMatch(/overlapping windows starting between 4 Jan 1999/);
    expect(text).toMatch(/S\$\d{2},\d{3}/);
    expect(text).toMatch(/not forecasts/);
  });

  it("uses whole dollars throughout for a scenario costing S$100 or more", () => {
    // Differences under S$100 too: "−S$85", never "−S$84.95".
    const figures = [...text.matchAll(/S\$[\d,]+(?:\.\d+)?/g)].map((m) => m[0]);
    expect(figures.length).toBeGreaterThan(5);
    for (const f of figures) expect(f).not.toMatch(/\./);
  });

  it("uses cents throughout for a scenario costing under S$100", () => {
    // 15,000 VND is well under a dollar: whole dollars would read S$1.
    const fx = loadFx("VND");
    const s = {
      ...scenario,
      currency: "VND",
      startDate: fx.dates.at(-1)!,
      deadline: addDays(fx.dates.at(-1)!, 290),
    };
    const t = describeReplay(
      replay(fx, s, { targetBelowSpot: 0.02 }),
      s,
      0.02,
    ).join(" ");
    for (const m of t.matchAll(/S\$[\d,]+(?:\.\d+)?/g))
      expect(m[0]).toMatch(/\.\d\d$/);
  });

  it("never names a strategy as coming top or bottom, in any history", () => {
    for (const [code, days, k] of [
      ["USD", 290, 6],
      ["JPY", 30, 2],
      ["VND", 730, 12],
      ["EUR", 180, 1],
      ["GBP", 400, 4],
    ] as const) {
      const fx = loadFx(code);
      const s = {
        ...scenario,
        currency: code,
        startDate: fx.dates.at(-1)!,
        deadline: addDays(fx.dates.at(-1)!, days),
        tranches: k,
      };
      const lines = describeReplay(
        replay(fx, s, { targetBelowSpot: 0.02 }),
        s,
        0.02,
      ).join(" ");
      expect(namesRanking(lines), code).toBeUndefined();
      for (const banned of ADVISORY) expect(lines).not.toMatch(banned);
    }
  });

  it("never uses advisory wording", () => {
    for (const banned of ADVISORY) expect(text).not.toMatch(banned);
  });

  it("describes every strategy with the same template, in the fixed order", () => {
    for (const [code, days, k] of [
      ["USD", 290, 6],
      ["JPY", 30, 2],
      ["VND", 730, 12],
      ["EUR", 180, 1],
      ["BND", 290, 6],
    ] as const) {
      const fx = loadFx(code);
      const s = {
        ...scenario,
        currency: code,
        startDate: fx.dates.at(-1)!,
        deadline: addDays(fx.dates.at(-1)!, days),
        tranches: k,
      };
      const lines = describeReplay(
        replay(fx, s, { targetBelowSpot: 0.02 }),
        s,
        0.02,
      );
      const perStrategy = lines.filter((l) => STRATEGY_SENTENCE.test(l));
      expect(
        perStrategy.map((l) => l.split(/[ :(]/).slice(0, 2).join(" ")),
        code,
      ).toEqual(["Equal tranches", "Wait until", "Target rate"]);
      // No sentence compares two strategies other than all at once.
      expect(comparesStrategies(lines.join(" ")), code).toBeUndefined();
    }
  });

  it("detects a sentence comparing two strategies", () => {
    expect(
      comparesStrategies(
        "In this history, spreading over 6 conversions had a most expensive case S$1,152 lower than waiting.",
      ),
    ).toBeDefined();
    expect(
      comparesStrategies(
        "Equal tranches (6 conversions): median −S$85 vs all at once, middle 90% S$18,511–S$19,963, worst case S$21,017; cheaper than all at once in 57% of windows.",
      ),
    ).toBeUndefined();
  });
});
