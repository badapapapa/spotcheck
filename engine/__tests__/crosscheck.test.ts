import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compoundedRate } from "../rates.ts";
import { runAll } from "../strategies.ts";
import { STRATEGY_IDS } from "../types.ts";
import { loadDff, loadSora, loadUsd } from "./helpers.ts";

// Expected values come from notebooks/crosscheck.ipynb, an independent
// numpy reimplementation written from the formulas, not ported from this code.
const fixture = <T>(name: string): { cases: T[] } =>
  JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", name), "utf8"));

describe("cross-check against the Python notebook", () => {
  it("compounded SORA and DFF match for 20 random windows", () => {
    const series = { SORA: loadSora(), "USD-DFF": loadDff() };
    const { cases } = fixture<{
      series: keyof typeof series;
      from: string;
      to: string;
      basis: 365 | 360;
      expected: number;
    }>("compounding-crosscheck.json");
    expect(cases).toHaveLength(20);
    for (const c of cases) {
      const ours = compoundedRate(series[c.series], c.from, c.to, c.basis);
      expect(ours, `${c.series} ${c.from}→${c.to}`).toBeCloseTo(c.expected, 12);
    }
  });

  it("all four strategies match for 20 random scenarios", () => {
    const fx = loadUsd();
    const { cases } = fixture<{
      startDate: string;
      deadline: string;
      amount: number;
      tranches: number;
      spread: number;
      targetRate: number;
      expected: Record<string, number>;
    }>("strategy-crosscheck.json");
    expect(cases).toHaveLength(20);
    for (const c of cases) {
      const r = runAll(fx, { currency: "USD", ...c });
      for (const id of STRATEGY_IDS) {
        const rel = Math.abs(r[id].totalSgd / c.expected[id]! - 1);
        expect(rel, `${id} ${c.startDate}`).toBeLessThan(1e-9);
      }
    }
  });
});
