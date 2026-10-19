import { describe, expect, it } from "vitest";
import { formatRate, formatSgd } from "../format.ts";
import { decimalsFor, niceTicks, sgdTickDecimals } from "../ticks.ts";

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
