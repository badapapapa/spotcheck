import { describe, expect, it } from "vitest";
import { addDays } from "@/engine/calendar.ts";
import { replay } from "@/engine/replay.ts";
import { STRATEGY_IDS } from "@/engine/types.ts";
import { loadFx, loadUsd } from "@/engine/__tests__/helpers.ts";
import { historicalAnswer, windowCount } from "../answer.ts";

const base = {
  currency: "USD",
  amount: 15_000,
  startDate: "2026-10-17",
  deadline: "2027-08-01",
  tranches: 6,
  spread: 0.005,
};

describe("historicalAnswer", () => {
  const fx = loadUsd();
  const r = replay(fx, base, { targetBelowSpot: 0.02 });
  const a = historicalAnswer(r);
  const median = (id: (typeof STRATEGY_IDS)[number]) =>
    r.stats[id].summary.median;

  it("picks the strategy with the lowest median", () => {
    for (const id of STRATEGY_IDS)
      expect(median(a.lowest)).toBeLessThanOrEqual(median(id));
    expect(a.medianGap).toBeCloseTo(median(a.reference) - median(a.lowest));
    expect(a.medianGap).toBeGreaterThanOrEqual(0);
  });

  it("compares with all at once unless all at once is the lowest", () => {
    if (a.lowest === "lumpSum") expect(a.reference).not.toBe("lumpSum");
    else expect(a.reference).toBe("lumpSum");
  });

  it("counts cheaper windows from the replay, consistent with the engine", () => {
    expect(a.windows).toBe(r.windows);
    if (a.reference === "lumpSum") {
      // The engine's own "share cheaper than lump sum" must agree.
      expect(a.cheaperWindows / a.windows).toBeCloseTo(
        r.stats[a.lowest].beatLumpSum,
        10,
      );
    }
  });

  it("reports the worst-case gap with its sign", () => {
    const ref = a.worstReference;
    expect(a.worstGap).toBeCloseTo(
      r.stats[ref].summary.max - r.stats[a.lowest].summary.max,
    );
    expect(ref).toBe(a.reference);
  });

  it("has no clear lowest for the BND peg, where everything costs the same", () => {
    const bnd = loadFx("BND");
    const s = { ...base, currency: "BND", startDate: bnd.dates.at(-1)! };
    s.deadline = addDays(s.startDate, 290);
    const peg = historicalAnswer(replay(bnd, s, { targetBelowSpot: 0.02 }));
    expect(peg.noClearLowest).toBe(true);
  });

  it("is consistent for every currency on the latest data", () => {
    for (const code of ["EUR", "JPY", "KRW", "VND", "GBP"]) {
      const f = loadFx(code);
      const s = { ...base, currency: code, startDate: f.dates.at(-1)! };
      s.deadline = addDays(s.startDate, 200);
      const res = replay(f, s, { targetBelowSpot: 0.02 });
      const ans = historicalAnswer(res);
      expect(ans.cheaperWindows).toBeLessThanOrEqual(ans.windows);
      expect(ans.medianGap).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("windowCount", () => {
  it("matches the number of windows the replay tests", () => {
    const fx = loadUsd();
    for (const deadline of ["2027-08-01", "2027-01-15", "2028-06-30"]) {
      const s = { ...base, deadline };
      expect(windowCount(fx, s)).toBe(
        replay(fx, s, { targetBelowSpot: 0.02 }).windows,
      );
    }
  });
});
