import { describe, expect, it } from "vitest";
import { replay } from "@/engine/replay.ts";
import { loadUsd } from "@/engine/__tests__/helpers.ts";
import { addMonths, stepMonth, windowCount } from "../periods.ts";

const base = {
  currency: "USD",
  amount: 15_000,
  startDate: "2026-10-17",
  deadline: "2027-08-01",
  tranches: 6,
  spread: 0.005,
};

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

describe("addMonths and stepMonth", () => {
  it("moves to the same calendar day, clamped to the month's end", () => {
    expect(addMonths("2026-01-28", -1)).toBe("2025-12-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2024-03-31", -1)).toBe("2024-02-29");
    expect(addMonths("2025-12-15", 1)).toBe("2026-01-15");
  });

  // The phone timeline's "One month earlier" once jumped from 28 Jan 2026 to
  // 15 Dec 2025 (bucket to bucket). It must land on the same day a month
  // earlier, or the nearest trading day to it.
  it("steps one calendar month to the nearest start date", () => {
    // A one-month plan, so the history runs well past January 2026.
    const short = { ...base, deadline: "2026-11-17" };
    const starts = replay(loadUsd(), short, {
      targetBelowSpot: 0.02,
    }).startDates;
    const i = starts.indexOf("2026-01-28");
    expect(i).toBeGreaterThan(0);
    const earlier = starts[stepMonth(starts, i, -1)]!;
    // 28 Dec 2025 is a Sunday: the nearest trading day is Monday the 29th.
    expect(earlier).toBe("2025-12-29");
    const j = starts.indexOf(earlier);
    expect(starts[stepMonth(starts, j, 1)]).toBe("2026-01-29");
  });

  it("stays put at either end of the history", () => {
    const starts = replay(loadUsd(), base, {
      targetBelowSpot: 0.02,
    }).startDates;
    expect(stepMonth(starts, 0, -1)).toBe(0);
    expect(stepMonth(starts, starts.length - 1, 1)).toBe(starts.length - 1);
  });
});
