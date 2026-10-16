import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compoundedRate, tenorStart, toContinuous } from "../rates.ts";
import { daily, loadSora, weekdays } from "./helpers.ts";

type Fixture = {
  values: {
    publicationDate: string;
    tenorMonths: number;
    publishedPercent: number;
  }[];
};
const fixture: Fixture = JSON.parse(
  readFileSync(
    join(import.meta.dirname, "fixtures", "compounded-sora.json"),
    "utf8",
  ),
);

describe("compoundedRate (MAS method)", () => {
  it("a constant rate compounds to itself only to first order", () => {
    const r = 0.03;
    const fx = daily("2024-01-01", Array(400).fill(r));
    const c = compoundedRate(fx, "2024-01-01", "2024-12-31");
    // Daily compounding over 365 days: ((1 + r/365)^365 - 1) × 365/365.
    expect(c).toBeCloseTo((1 + r / 365) ** 365 - 1, 12);
    expect(c).toBeGreaterThan(r);
  });

  it("a Friday rate applies for 3 days", () => {
    // Thu 4.0%, Fri 1.0%, Mon 4.0%: window Thu → Tue covers Thu(1), Fri(3), Mon(1).
    const sora = weekdays("2024-01-04", [0.04, 0.01, 0.04]);
    const c = compoundedRate(sora, "2024-01-04", "2024-01-09");
    const growth = (1 + 0.04 / 365) * (1 + (0.01 * 3) / 365) * (1 + 0.04 / 365);
    expect(c).toBeCloseTo(((growth - 1) * 365) / 5, 14);
  });

  it("uses ACT/360 when asked (USD money-market rates)", () => {
    const usd = daily("2024-01-01", Array(10).fill(0.05));
    const c = compoundedRate(usd, "2024-01-01", "2024-01-02", 360);
    expect(c).toBeCloseTo((0.05 / 360) * 365, 12);
  });

  it(`reproduces ${fixture.values.length} published MAS compounded SORA values to within 1 bp (Gate 2)`, () => {
    const sora = loadSora();
    expect(fixture.values.length).toBeGreaterThanOrEqual(20);
    for (const v of fixture.values) {
      const end = v.publicationDate;
      const ours = compoundedRate(sora, tenorStart(end, v.tenorMonths), end);
      expect(
        Math.abs(ours - v.publishedPercent / 100),
        `${end} ${v.tenorMonths}M`,
      ).toBeLessThan(0.0001);
    }
  });

  it("reproduces every published value since Aug 2020 to MAS's 4-dp rounding", () => {
    const file = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "..", "..", "data", "rates", "SORA.json"),
        "utf8",
      ),
    ) as {
      rows: [
        string,
        string,
        number,
        number | null,
        number | null,
        number | null,
      ][];
    };
    const sora = loadSora();
    let checked = 0;
    let maxError = 0;
    for (const [, pub, , ...published] of file.rows) {
      // MAS started publishing compounded SORA on 6 Aug 2020; earlier rows
      // in its download are back-calculated.
      if (pub < "2020-08-06") continue;
      published.forEach((p, k) => {
        if (p === null) return;
        const months = [1, 3, 6][k]!;
        const ours = compoundedRate(sora, tenorStart(pub, months), pub);
        maxError = Math.max(maxError, Math.abs(ours - p));
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(4000);
    // MAS publishes both daily SORA and compounded SORA to 4 dp in percent
    // (1e-6 as a decimal), so tiny rounding differences are expected. The
    // worst case over all published values is about 0.0101 bp, 100x inside
    // the plan's 1 bp gate.
    expect(maxError).toBeLessThan(1.5e-6);
  });
});

describe("toContinuous", () => {
  it("is ln(1 + rT)/T and slightly below the simple rate", () => {
    expect(toContinuous(0.05, 0.5)).toBeCloseTo(Math.log(1.025) / 0.5, 15);
    expect(toContinuous(0.05, 0.5)).toBeLessThan(0.05);
  });
});
