import { describe, expect, it } from "vitest";
import { randomInt, seeded } from "../rng.ts";
import { MAD_TO_SD, median, robustZ, rollingRobust } from "../robust.ts";

describe("seeded", () => {
  it("repeats exactly for a seed, and differs between seeds", () => {
    const a = Array.from({ length: 5 }, seeded(42));
    const b = Array.from({ length: 5 }, seeded(42));
    const c = Array.from({ length: 5 }, seeded(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("stays in [0, 1), and randomInt in [0, n)", () => {
    const r = seeded(7);
    for (let i = 0; i < 1000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const k = randomInt(r, 5);
      expect(Number.isInteger(k) && k >= 0 && k < 5).toBe(true);
    }
  });
});

describe("median", () => {
  it("handles odd, even and empty inputs without changing them", () => {
    const xs = [5, 1, 3];
    expect(median(xs)).toBe(3);
    expect(xs).toEqual([5, 1, 3]);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});

describe("rollingRobust", () => {
  it("uses only the days before each one, once there are enough", () => {
    const { center, scale } = rollingRobust([1, 2, 3, 4, 5, 100], 10, 5);
    expect(center.slice(0, 5).every(Number.isNaN)).toBe(true);
    // Day 5 sees 1..5 (not its own 100): median 3, MAD 1.
    expect(center[5]).toBe(3);
    expect(scale[5]).toBeCloseTo(MAD_TO_SD, 10);
  });

  it("keeps only the last `window` values and skips NaN", () => {
    const { center } = rollingRobust([NaN, 100, 1, 1, 1, 0], 3, 3);
    // Day 5 sees the last three finite values before it: 1, 1, 1.
    expect(center[5]).toBe(1);
  });
});

describe("robustZ", () => {
  it("floors the scale, so a flat history can't make a tiny move huge", () => {
    expect(robustZ(0.002, 0, 0, 0.001)).toBe(2);
    expect(robustZ(0.02, 0, 0.01, 0.001)).toBe(2);
    expect(robustZ(1, NaN, 1, 0.001)).toBeNaN();
  });
});
