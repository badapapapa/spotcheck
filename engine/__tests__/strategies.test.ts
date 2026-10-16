import { describe, expect, it } from "vitest";
import { lumpSum, runAll, target, tranches, wait } from "../strategies.ts";
import { STRATEGY_IDS } from "../types.ts";
import { baseScenario, daily } from "./helpers.ts";

const flat = daily("2024-01-01", Array(200).fill(1.35));
const rising = daily(
  "2024-01-01",
  Array.from({ length: 200 }, (_, i) => 1.3 + i * 0.001),
);

describe("strategies", () => {
  it("on a flat history every strategy costs the same", () => {
    const r = runAll(flat, baseScenario);
    const expected = 15_000 * 1.35 * 1.005;
    for (const id of STRATEGY_IDS)
      expect(r[id].totalSgd).toBeCloseTo(expected, 8);
  });

  it("tranches with k = 1 equals lump sum", () => {
    const s = { ...baseScenario, tranches: 1 };
    expect(tranches(rising, s).totalSgd).toBe(lumpSum(rising, s).totalSgd);
    expect(tranches(rising, s).conversions).toEqual(
      lumpSum(rising, s).conversions,
    );
  });

  it("costs scale linearly with amount", () => {
    const double = { ...baseScenario, amount: 30_000 };
    const a = runAll(rising, baseScenario);
    const b = runAll(rising, double);
    for (const id of STRATEGY_IDS)
      expect(b[id].totalSgd).toBeCloseTo(2 * a[id].totalSgd, 8);
  });

  it("tranches convert amount/k units each and sum to the amount", () => {
    const r = tranches(rising, baseScenario);
    expect(r.conversions).toHaveLength(6);
    expect(r.conversions.reduce((s, c) => s + c.units, 0)).toBeCloseTo(
      15_000,
      10,
    );
    expect(r.conversions[0]!.date).toBe("2024-01-01");
    expect(r.conversions.at(-1)!.date).toBe("2024-07-01");
  });

  it("includes the spread on every conversion", () => {
    const r = lumpSum(flat, baseScenario);
    expect(r.conversions[0]!.sgd).toBeCloseTo(15_000 * 1.35 * 1.005, 10);
  });

  it("wait converts on the deadline", () => {
    expect(wait(rising, baseScenario).conversions[0]!.date).toBe("2024-07-01");
  });

  it("target converts on the first day at or below the target", () => {
    const fx = daily("2024-01-01", [
      1.35,
      1.34,
      1.29,
      1.25,
      1.36,
      ...Array(200).fill(1.4),
    ]);
    const r = target(fx, { ...baseScenario, targetRate: 1.3 });
    expect(r.conversions).toEqual([
      {
        date: "2024-01-03",
        units: 15_000,
        rate: 1.29,
        sgd: 15_000 * 1.29 * 1.005,
      },
    ]);
  });

  it("target falls back to the deadline if never hit", () => {
    const r = target(rising, { ...baseScenario, targetRate: 1.0 });
    expect(r.conversions[0]!.date).toBe("2024-07-01");
  });
});
