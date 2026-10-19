import { describe, expect, it } from "vitest";
import { percentile, realisedVol, summarize } from "../stats.ts";
import { daysBetween } from "../calendar.ts";
import type { Series } from "../types.ts";
import { daily, loadFx, loadUsd, weekdays } from "./helpers.ts";

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
    const fx = weekdays("2024-01-01", Array(100).fill(1.35));
    expect(realisedVol(fx, "2024-05-20", 60).sigma).toBe(0);
  });

  it("annualises with √252 over trading days, whatever the calendar span", () => {
    const values = [1];
    for (let i = 1; i < 120; i++)
      values.push(values[i - 1]! * Math.exp(i % 2 ? 0.01 : -0.01));
    const fx = weekdays("2024-01-01", values);
    const pricing = "2024-06-14"; // after the 120 weekdays
    const v = realisedVol(fx, pricing, 90);
    expect(v.observations).toBe(90);
    // Sample std of ±0.01 with n = 90 is 0.01 × sqrt(90/89).
    expect(v.sigma).toBeCloseTo(0.01 * Math.sqrt(90 / 89) * Math.sqrt(252), 10);
    expect(v.to < pricing).toBe(true);
  });

  it("refuses a series with weekend rows (would dilute volatility)", () => {
    const fx = daily(
      "2024-01-01",
      Array.from({ length: 100 }, (_, i) => 1 + 0.001 * (i % 2)),
    );
    expect(() => realisedVol(fx, "2024-04-01", 60)).toThrow(/weekend/);
  });

  it("60 trading days back spans about 12 calendar weeks, not 60 calendar days", () => {
    const fx = weekdays(
      "2024-01-01",
      Array.from({ length: 200 }, (_, i) => 1 + 0.001 * (i % 2)),
    );
    const v = realisedVol(fx, "2024-08-01", 60);
    expect(daysBetween(v.from, v.to)).toBeGreaterThanOrEqual(82);
  });

  it("uses only data strictly before the pricing date", () => {
    const fx = weekdays(
      "2024-01-01",
      Array.from({ length: 100 }, (_, i) => 1 + 0.001 * (i % 3)),
    );
    const before = realisedVol(fx, "2024-04-15", 60);
    const altered = {
      ...fx,
      values: fx.values.map((v, i) =>
        fx.dates[i]! >= "2024-04-15" ? v * 5 : v,
      ),
    };
    expect(realisedVol(altered, "2024-04-15", 60)).toEqual(before);
  });

  it("USD/SGD from the committed data: 60 trading days before 16 Oct 2026", () => {
    const v = realisedVol(loadUsd(), "2026-10-16", 60);
    expect(v.observations).toBe(60);
    // About three calendar months, not two.
    expect(v.from < "2026-07-25").toBe(true);
  });
});

describe("ECB-sourced data: daily vs weekly volatility (option B as a check)", () => {
  // Smoothed (blended) data shows daily vol far below weekly; a single
  // fixing shouldn't. Non-overlapping 5-observation returns, × √(252/5).
  const sd = (fx: Series, step: number) => {
    const r: number[] = [];
    for (let i = step; i < fx.values.length; i += step)
      r.push(Math.log(fx.values[i]! / fx.values[i - step]!));
    const m = r.reduce((a, b) => a + b, 0) / r.length;
    return Math.sqrt(
      (r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1)) * (252 / step),
    );
  };

  it.each([
    ["USD", "1999-01-04"],
    ["CNY", "2000-01-13"],
    ["INR", "2000-01-13"],
  ])(
    "%s (from %s): weekly-return volatility within 15 percent of daily",
    (code, start) => {
      const fx = loadFx(code);
      expect(fx.dates[0]).toBe(start);
      expect(Math.abs(sd(fx, 5) / sd(fx, 1) - 1)).toBeLessThan(0.15);
    },
  );
});
