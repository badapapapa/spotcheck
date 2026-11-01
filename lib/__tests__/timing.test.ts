import { describe, expect, it } from "vitest";
import { daysBetween } from "@/engine/calendar.ts";
import { sampleWindow } from "@/engine/replay.ts";
import { STRATEGY_IDS, type Scenario } from "@/engine/types.ts";
import { daily } from "@/engine/__tests__/helpers.ts";
import { timing } from "../timing.ts";

// The diagram on How it works must match what the engine actually does.

const scenario: Scenario = {
  currency: "USD",
  amount: 1000,
  startDate: "2024-01-01",
  deadline: "2024-07-01",
  tranches: 6,
  spread: 0,
};
const days = daysBetween(scenario.startDate, scenario.deadline);
const flat = daily("2024-01-01", Array(days + 1).fill(1.35));
/** Where each conversion fell, as a fraction of the plan. */
const fractions = (fx: typeof flat, id: (typeof STRATEGY_IDS)[number]) =>
  sampleWindow(fx, scenario, scenario.startDate, {
    targetBelowSpot: 0.02,
  }).results[id].conversions.map(
    (c) => daysBetween(scenario.startDate, c.date) / days,
  );

describe("the timing diagram", () => {
  const t = timing(scenario.tranches);

  it("lists the strategies in the fixed order", () => {
    expect(Object.keys(t)).toEqual(STRATEGY_IDS);
  });

  it("matches the engine for all at once, equal tranches and waiting", () => {
    for (const id of ["lumpSum", "tranches", "wait"] as const) {
      const engine = fractions(flat, id);
      const diagram = t[id].marks.map((m) => m.at);
      expect(engine).toHaveLength(diagram.length);
      engine.forEach((f, i) => expect(f).toBeCloseTo(diagram[i]!, 1));
    }
    // Exactly: the first part on the start date, the last on the deadline.
    expect(fractions(flat, "tranches")[0]).toBe(0);
    expect(fractions(flat, "tranches").at(-1)).toBe(1);
  });

  it("shows the target's two cases: reached in between, or the deadline", () => {
    // Never reached (a flat rate): one conversion, on the deadline.
    expect(fractions(flat, "target")).toEqual([1]);
    expect(t.target.marks.find((m) => m.fallback)!.at).toBe(1);
    // Reached partway: one conversion, strictly between start and deadline.
    const dip = daily(
      "2024-01-01",
      Array.from({ length: days + 1 }, (_, i) => (i >= 80 ? 1.3 : 1.35)),
    );
    const reached = fractions(dip, "target");
    expect(reached).toHaveLength(1);
    expect(reached[0]).toBeGreaterThan(0);
    expect(reached[0]).toBeLessThan(1);
    const shown = t.target.marks.find((m) => !m.fallback)!.at;
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(1);
  });
});
