import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  gkCall,
  gkCallGreeks,
  gkPut,
  normCdf,
  normPdf,
  optionHedgedCost,
  type GkInputs,
} from "../options.ts";

const base: GkInputs = {
  S: 1.6,
  K: 1.6,
  rd: 0.08,
  rf: 0.11,
  sigma: 0.2,
  T: 0.5,
};

describe("normCdf", () => {
  it("matches known values to 1e-12", () => {
    // Reference values from scipy.stats.norm.cdf.
    const known: [number, number][] = [
      [0, 0.5],
      [1, 0.8413447460685429],
      [-1, 0.15865525393145707],
      [-1.959963984540054, 0.025],
      [2.5, 0.9937903346742238],
      [-3, 0.0013498980316301035],
      [-6, 9.865876450376946e-10],
      [8, 0.9999999999999993],
    ];
    for (const [x, p] of known)
      expect(normCdf(x), `N(${x})`).toBeCloseTo(p, 12);
  });

  it("is symmetric: N(x) + N(-x) = 1", () => {
    for (const x of [0.1, 0.7, 1.3, 2.9, 5, 7.5, 12]) {
      expect(normCdf(x) + normCdf(-x)).toBeCloseTo(1, 14);
    }
  });

  it("handles the far tails", () => {
    expect(normCdf(-40)).toBe(0);
    expect(normCdf(40)).toBe(1);
  });
});

describe("Garman-Kohlhagen", () => {
  it("reproduces the textbook reference value C ≈ 0.07505 (plan §3.8)", () => {
    expect(gkCall(base)).toBeCloseTo(0.07505, 5);
  });

  it("put-call parity holds to 1e-10", () => {
    for (const p of [
      base,
      { ...base, K: 1.5 },
      { ...base, rd: 0.01, rf: 0.04, T: 1.2, sigma: 0.07 },
    ]) {
      const parity = p.S * Math.exp(-p.rf * p.T) - p.K * Math.exp(-p.rd * p.T);
      expect(Math.abs(gkCall(p) - gkPut(p) - parity)).toBeLessThan(1e-10);
    }
  });

  it("price rises with volatility and with spot", () => {
    let prev = 0;
    for (const sigma of [0.02, 0.05, 0.1, 0.2, 0.4]) {
      const c = gkCall({ ...base, sigma });
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
    prev = 0;
    for (const S of [1.3, 1.45, 1.6, 1.75, 1.9]) {
      const c = gkCall({ ...base, S });
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });

  it("0 < delta < e^(−r_f T)", () => {
    for (const S of [1.0, 1.4, 1.6, 1.8, 2.4]) {
      const { delta } = gkCallGreeks({ ...base, S });
      expect(delta).toBeGreaterThan(0);
      expect(delta).toBeLessThan(Math.exp(-base.rf * base.T));
    }
  });

  it("rejects non-positive inputs", () => {
    expect(() => gkCall({ ...base, sigma: 0 })).toThrow();
    expect(() => gkCall({ ...base, T: 0 })).toThrow();
  });
});

describe("Greeks vs central finite differences", () => {
  const cases: GkInputs[] = [
    base,
    { S: 1.35, K: 1.3, rd: 0.025, rf: 0.045, sigma: 0.06, T: 0.8 },
    { S: 1.35, K: 1.45, rd: 0.03, rf: 0.01, sigma: 0.12, T: 0.25 },
  ];
  it.each(cases)("match for %o", (p) => {
    const g = gkCallGreeks(p);
    const h = 1e-4;
    const at = (q: Partial<GkInputs>) => gkCall({ ...p, ...q });
    const delta = (at({ S: p.S + h }) - at({ S: p.S - h })) / (2 * h);
    const gamma =
      (at({ S: p.S + h }) - 2 * gkCall(p) + at({ S: p.S - h })) / (h * h);
    const vega =
      (at({ sigma: p.sigma + h }) - at({ sigma: p.sigma - h })) / (2 * h);
    // Theta is per year of calendar time, so it is minus the derivative in T.
    const theta = -(at({ T: p.T + h }) - at({ T: p.T - h })) / (2 * h);
    // Central differences with h = 1e-4 are accurate to about h² ≈ 1e-8.
    expect(g.delta).toBeCloseTo(delta, 6);
    expect(g.gamma).toBeCloseTo(gamma, 4);
    expect(g.vega).toBeCloseTo(vega, 6);
    expect(g.theta).toBeCloseTo(theta, 6);
  });

  it("normPdf integrates to the CDF difference", () => {
    // Simpson's rule over [-1, 1].
    const n = 200;
    let sum = 0;
    for (let i = 0; i <= n; i++) {
      const x = -1 + (2 * i) / n;
      sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * normPdf(x);
    }
    expect((sum * 2) / n / 3).toBeCloseTo(normCdf(1) - normCdf(-1), 9);
  });
});

describe("cross-check against scipy (Gate 4)", () => {
  type Case = GkInputs & {
    expected: Record<
      "call" | "put" | "delta" | "gamma" | "vega" | "theta",
      number
    >;
  };
  const { cases } = JSON.parse(
    readFileSync(
      join(import.meta.dirname, "fixtures", "gk-crosscheck.json"),
      "utf8",
    ),
  ) as { cases: Case[] };

  it("20 random inputs match price and Greeks to 1e-6", () => {
    expect(cases).toHaveLength(20);
    for (const c of cases) {
      const g = gkCallGreeks(c);
      const ours = { call: gkCall(c), put: gkPut(c), ...g };
      for (const k of Object.keys(c.expected) as (keyof Case["expected"])[]) {
        expect(
          Math.abs(ours[k] - c.expected[k]),
          `${k} for ${JSON.stringify(c)}`,
        ).toBeLessThan(1e-6);
      }
    }
  });
});

describe("optionHedgedCost", () => {
  it("caps the conversion rate at the strike and adds the premium", () => {
    // Market above strike: convert at the strike.
    expect(optionHedgedCost(1000, 0.02, 1.35, 1.4, 0.005)).toBeCloseTo(
      1000 * (0.02 + 1.35 * 1.005),
      10,
    );
    // Market below strike: convert at the market.
    expect(optionHedgedCost(1000, 0.02, 1.35, 1.3, 0.005)).toBeCloseTo(
      1000 * (0.02 + 1.3 * 1.005),
      10,
    );
  });
});
