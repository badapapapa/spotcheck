import { describe, expect, it } from "vitest";
import { formatRate, formatSgd } from "../format.ts";
import { decimalsFor, isFlat, niceTicks, sgdTickDecimals } from "../ticks.ts";

const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe("niceTicks", () => {
  it("decimals follow the spacing", () => {
    expect(decimalsFor(1000)).toBe(0);
    expect(decimalsFor(0.25)).toBe(2);
    expect(decimalsFor(0.05)).toBe(2);
    expect(decimalsFor(0.0005)).toBe(4);
    expect(decimalsFor(0.000002)).toBe(6);
  });

  it.each([
    ["S$18k–22k (USD 15,000)", 17_890, 22_009],
    ["S$13–16 (KRW 15,000)", 13.2, 15.9],
    ["S$1.1–1.4 (IDR 15,000)", 1.13, 1.38],
    ["S$0.70–0.80 (VND 15,000)", 0.7012, 0.7963],
    ["a very narrow band", 0.73123, 0.73161],
  ])("SGD tick labels are never identical: %s", (_, lo, hi) => {
    const t = niceTicks(lo, hi, 4);
    const labels = t.ticks.map((v) =>
      formatSgd(v, { decimals: sgdTickDecimals(t) }),
    );
    expect(t.ticks.length).toBeGreaterThanOrEqual(2);
    expect(unique(labels), labels.join(" ")).toBe(true);
  });

  it("rate tick labels are never identical, even for VND (~0.00005 SGD)", () => {
    const t = niceTicks(0.00004871, 0.00004934, 5);
    const labels = t.ticks.map((v) => v.toFixed(t.decimals));
    expect(unique(labels), labels.join(" ")).toBe(true);
    expect(formatRate(0.00004871)).toBe("0.00004871");
  });

  it("a flat range still gets distinct ticks", () => {
    const t = niceTicks(19_309, 19_309, 4);
    expect(
      unique(
        t.ticks.map((v) => formatSgd(v, { decimals: sgdTickDecimals(t) })),
      ),
    ).toBe(true);
  });
});

// F01: the BND peg over 24 conversions with a 5% fee costs S$10,500 in one
// period and S$10,500.000000000002 in another. That rounding noise sent the
// tick loop past 2^53, where k++ stops changing k, until the page crashed
// with "RangeError: Invalid array length".
describe("niceTicks with no real range", () => {
  const sane = (t: ReturnType<typeof niceTicks>) => {
    expect(t.ticks.length).toBeGreaterThanOrEqual(2);
    expect(t.ticks.length).toBeLessThanOrEqual(50);
    expect(t.ticks.every(Number.isFinite)).toBe(true);
    expect(t.domain[1]).toBeGreaterThan(t.domain[0]);
    expect(unique(t.ticks.map(String))).toBe(true);
  };

  it("rounding noise is read as flat", () => {
    const t = niceTicks(10500, 10500.000000000002, 6);
    sane(t);
    // The same small band as an exactly flat range, around the value.
    expect(t.domain[0]).toBeLessThan(10500);
    expect(t.domain[1]).toBeGreaterThan(10500);
    expect(t).toEqual(niceTicks(10500, 10500, 6));
  });

  it.each([1e-6, 1, 1e4, 1e12, 1.5e15])(
    "noise at %d (relative 1e-12 to 1e-10) stays a handful of ticks",
    (v) => {
      for (const rel of [1e-12, 1e-11, 1e-10])
        sane(niceTicks(v, v * (1 + rel), 6));
    },
  );

  it("zero, negative zero and reversed inputs", () => {
    sane(niceTicks(0, 0));
    sane(niceTicks(-0, 0));
    sane(niceTicks(5, 3));
  });

  it("values that aren't finite never loop", () => {
    for (const [a, b] of [
      [Number.NaN, 5],
      [5, Number.NaN],
      [Number.NaN, Number.NaN],
      [0, Number.POSITIVE_INFINITY],
      [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
    ])
      sane(niceTicks(a!, b!));
  });

  it("a real but narrow range is still drawn as a range", () => {
    // 1 cent across S$10,500: small, but data, not noise.
    const t = niceTicks(10500, 10500.01, 4);
    sane(t);
    expect(t.domain[1] - t.domain[0]).toBeLessThan(0.1);
  });

  it("isFlat compares the span with the values' size", () => {
    expect(isFlat(10500, 10500.000000000002)).toBe(true);
    expect(isFlat(10500, 10500.01)).toBe(false);
    expect(isFlat(0, 0)).toBe(true);
    expect(isFlat(0, 1e-12)).toBe(false);
    expect(isFlat(1, Number.NaN)).toBe(true);
  });
});
