import { describe, expect, it } from "vitest";
import { percentile, realisedVol, summarize } from "../stats.ts";
import { daily } from "./helpers.ts";

describe("percentile", () => {
  // Hand-computed: positions (n-1)p on [1, 2, 3, 4, 10].
  const xs = [1, 2, 3, 4, 10];
  it("matches hand-computed linear interpolation", () => {
    expect(percentile(xs, 0)).toBe(1);
    expect(percentile(xs, 0.5)).toBe(3);
    expect(percentile(xs, 1)).toBe(10);
    expect(percentile(xs, 0.05)).toBeCloseTo(1.2, 12); // pos 0.2
    expect(percentile(xs, 0.95)).toBeCloseTo(8.8, 12); // pos 3.8 → 4 + 0.8×6
    expect(percentile(xs, 0.25)).toBe(2);
  });

  it("summarize sorts first and reports all fields", () => {
    const s = summarize([10, 3, 1, 4, 2]);
    expect(s).toMatchObject({ count: 5, min: 1, median: 3, max: 10, mean: 4 });
    expect(s.p5).toBeCloseTo(1.2, 12);
    expect(s.p95).toBeCloseTo(8.8, 12);
  });
});

describe("realisedVol", () => {
  it("is zero for a constant series", () => {
    const fx = daily("2024-01-01", Array(100).fill(1.35));
    expect(realisedVol(fx, "2024-04-01", 60).sigma).toBe(0);
  });

  it("annualises alternating ±1% daily log returns to about 1% × √365", () => {
    const values = [1];
    for (let i = 1; i < 120; i++)
      values.push(values[i - 1]! * Math.exp(i % 2 ? 0.01 : -0.01));
    const fx = daily("2024-01-01", values);
    const v = realisedVol(fx, "2024-04-20", 90);
    expect(v.observations).toBe(90);
    // Sample std of ±0.01 with n = 90 is 0.01 × sqrt(90/89).
    expect(v.sigma).toBeCloseTo(0.01 * Math.sqrt(90 / 89) * Math.sqrt(365), 6);
    expect(v.to < "2024-04-20").toBe(true);
  });

  it("uses only data strictly before the pricing date", () => {
    const fx = daily(
      "2024-01-01",
      Array.from({ length: 100 }, (_, i) => 1 + 0.001 * (i % 3)),
    );
    const before = realisedVol(fx, "2024-03-15", 60);
    const altered = {
      ...fx,
      values: fx.values.map((v, i) =>
        fx.dates[i]! >= "2024-03-15" ? v * 5 : v,
      ),
    };
    expect(realisedVol(altered, "2024-03-15", 60)).toEqual(before);
  });
});
