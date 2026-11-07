import { describe, expect, it } from "vitest";
import { sampleWindow } from "@/engine/replay.ts";
import { isWeekend } from "@/engine/calendar.ts";
import { STRATEGY_IDS } from "@/engine/types.ts";
import { loadUsd } from "@/engine/__tests__/helpers.ts";
import { scheduledDates } from "../scheduled.ts";

const fx = loadUsd();
const scenario = {
  currency: "USD",
  amount: 15_000,
  startDate: "2026-10-17",
  deadline: "2027-08-01",
  tranches: 6,
  spread: 0.005,
};

describe("scheduledDates", () => {
  it("one per conversion, and never after the date whose rate was used", () => {
    for (const start of [
      "2026-01-22",
      "2025-06-02",
      "2020-03-16",
      "2008-09-15",
    ]) {
      const w = sampleWindow(fx, scenario, start, { targetBelowSpot: 0.02 });
      const sched = scheduledDates(w, scenario.tranches);
      for (const id of STRATEGY_IDS) {
        const conv = w.results[id].conversions;
        expect(sched[id]).toHaveLength(conv.length);
        conv.forEach((c, i) => expect(sched[id][i]! <= c.date).toBe(true));
      }
    }
  });

  it("a weekend in the schedule moves to the next published rate", () => {
    // The latest period of this plan schedules a tranche on Sat 21 Mar 2026.
    const w = sampleWindow(fx, scenario, "2026-01-22", {
      targetBelowSpot: 0.02,
    });
    const sched = scheduledDates(w, scenario.tranches).tranches;
    const moved = sched
      .map((d, i) => [d, w.results.tranches.conversions[i]!.date] as const)
      .filter(([d, used]) => d !== used);
    expect(moved.length).toBeGreaterThan(0);
    for (const [d, used] of moved) {
      expect(isWeekend(d) || !fx.dates.includes(d)).toBe(true);
      expect(fx.dates.includes(used)).toBe(true);
    }
    expect(moved[0]).toEqual(["2026-03-21", "2026-03-23"]);
  });

  it("target rate: the day it was reached, else the deadline", () => {
    for (const start of [
      "2026-01-22",
      "2025-06-02",
      "2020-03-16",
      "2008-09-15",
    ]) {
      const w = sampleWindow(fx, scenario, start, { targetBelowSpot: 0.02 });
      const [sched] = scheduledDates(w, 6).target;
      const used = w.results.target.conversions[0]!.date;
      if (used <= w.deadline) expect(sched).toBe(used);
      else expect(sched).toBe(w.deadline);
    }
  });
});
