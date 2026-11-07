import { describe, expect, it } from "vitest";
import { formatSgd, formatSgdCompactTicks } from "../format.ts";

describe("formatSgdCompactTicks", () => {
  it("one unit per axis, from its largest tick", () => {
    expect(formatSgdCompactTicks([1e12, 1.5e12, 2e12], 5e11)).toEqual([
      "S$1.0T",
      "S$1.5T",
      "S$2.0T",
    ]);
    expect(formatSgdCompactTicks([1.5e9, 2e9], 5e8)).toEqual([
      "S$1.5B",
      "S$2.0B",
    ]);
    expect(formatSgdCompactTicks([18_000, 20_000, 22_000], 2000)).toEqual([
      "S$18K",
      "S$20K",
      "S$22K",
    ]);
  });

  it("decimals enough to keep neighbouring ticks apart", () => {
    const t = formatSgdCompactTicks([1.2e12, 1.25e12, 1.3e12], 5e10);
    expect(t).toEqual(["S$1.20T", "S$1.25T", "S$1.30T"]);
    expect(new Set(t).size).toBe(3);
  });

  it("values under a thousand are left whole", () => {
    expect(formatSgdCompactTicks([200, 400], 200)).toEqual(["S$200", "S$400"]);
  });
});

describe("formatSgd", () => {
  it("shows whole dollars from S$100 up", () => {
    expect(formatSgd(19_312.4)).toBe("S$19,312");
    expect(formatSgd(100)).toBe("S$100");
    expect(formatSgd(-1_064.6)).toBe("−S$1,065");
  });

  it("shows cents under S$100", () => {
    expect(formatSgd(84.13)).toBe("S$84.13");
    expect(formatSgd(0.7391)).toBe("S$0.74");
    expect(formatSgd(99.994)).toBe("S$99.99");
    expect(formatSgd(99.996)).toBe("S$100"); // rounds up into whole dollars
  });

  it("never shows a negative zero", () => {
    expect(formatSgd(-0.003)).toBe("S$0.00");
  });

  it("takes explicit decimals for axis ticks", () => {
    expect(formatSgd(0.7, { decimals: 2 })).toBe("S$0.70");
    expect(formatSgd(20_000, { decimals: 0 })).toBe("S$20,000");
  });
});

describe("A10 figure formats", () => {
  it("never shows a premium in scientific notation", async () => {
    const { formatPremiumPerUnit } = await import("../format.ts");
    expect(formatPremiumPerUnit(2.25e-10)).toBe("<0.000001");
    expect(formatPremiumPerUnit(0.002945)).toBe("0.002945");
    expect(formatPremiumPerUnit(0)).toBe("0.000");
  });
  it("uses U+2212 for negative forward points, in both places", async () => {
    const { formatPips } = await import("../format.ts");
    expect(formatPips(-0.02453)).toBe("−245.3 pips (−0.02453)");
    expect(formatPips(0.0012)).toBe("12.0 pips (+0.001200)");
    expect(formatPips(-0.02453)).not.toMatch(/-/);
  });
  it("shows the BND peg's rates at four decimals", async () => {
    const { formatPegRate } = await import("../format.ts");
    expect(formatPegRate(0.98)).toBe("0.9800");
    expect(formatPegRate(1)).toBe("1.0000");
  });
});

describe("rounded differences", () => {
  it("agrees with the rounded figures shown beside it", async () => {
    const { signedDiff } = await import("../signed.ts");
    // Medians shown as S$121 and S$122 differ by S$1, not S$0.
    expect(signedDiff(121.4, 121.6, 19_000)).toBe("−S$1");
    expect(signedDiff(121.6, 121.4, 19_000)).toBe("+S$1");
    expect(signedDiff(121.2, 121.4, 19_000)).toBe("S$0");
    expect(signedDiff(0.746, 0.736, 0.74)).toBe("+S$0.01");
  });
});

describe("planLength", () => {
  it("counts days for plans under four weeks", async () => {
    const { planLength } = await import("../dates.ts");
    expect(planLength(14)).toBe("14-day");
    expect(planLength(7)).toBe("7-day");
    expect(planLength(30)).toBe("1-month");
    expect(planLength(288)).toBe("9-month");
  });
});
