import { describe, expect, it } from "vitest";
import {
  forwardHedgeCost,
  forwardPoints,
  forwardRate,
  priceForward,
} from "../forwards.ts";
import { daily, loadDff, loadSora, loadUsd } from "./helpers.ts";

describe("forwardRate (covered interest parity)", () => {
  it("equals spot when r_d = r_f", () => {
    expect(forwardRate(1.35, 0.03, 0.03, 0.75)).toBeCloseTo(1.35, 15);
  });

  it("is above spot when SGD rates are higher, below when lower", () => {
    expect(forwardRate(1.35, 0.04, 0.02, 0.5)).toBeGreaterThan(1.35);
    expect(forwardRate(1.35, 0.02, 0.04, 0.5)).toBeLessThan(1.35);
  });

  it("matches a hand calculation", () => {
    // 1.35 × (1 + 0.03 × 0.5) / (1 + 0.05 × 0.5) = 1.35 × 1.015 / 1.025
    expect(forwardRate(1.35, 0.03, 0.05, 0.5)).toBeCloseTo(
      1.3368292682926829,
      14,
    );
    expect(forwardPoints(1.35, 1.3368292682926829)).toBeCloseTo(
      -0.0131707317,
      9,
    );
  });

  it("hedge cost is amount × F × (1 + spread)", () => {
    expect(forwardHedgeCost(15_000, 1.34, 0.005)).toBeCloseTo(
      15_000 * 1.34 * 1.005,
      9,
    );
  });
});

describe("priceForward", () => {
  const inputs = {
    fx: loadUsd(),
    sgdOvernight: loadSora(),
    foreignOvernight: loadDff(),
    foreignBasis: 360 as const,
  };

  it("prices from data known on the pricing date only (look-ahead guard)", () => {
    const date = "2023-06-15";
    const q = priceForward(inputs, date, "2023-12-15");
    const cut = <T extends { dates: string[]; values: number[] }>(
      s: T,
      f: number,
    ) => ({
      dates: s.dates,
      values: s.values.map((v, i) => (s.dates[i]! >= date ? v * f : v)),
    });
    const altered = {
      ...inputs,
      fx: {
        ...cut(inputs.fx, 2),
        values: inputs.fx.values.map((v, i) =>
          inputs.fx.dates[i]! > date ? v * 2 : v,
        ),
      },
      sgdOvernight: cut(inputs.sgdOvernight, 3),
      foreignOvernight: cut(inputs.foreignOvernight, 3),
    };
    expect(priceForward(altered, date, "2023-12-15")).toEqual(q);
  });

  it("gives a forward below spot in 2023 (USD rates above SGD rates)", () => {
    const q = priceForward(inputs, "2023-06-15", "2023-12-15");
    expect(q.rf).toBeGreaterThan(q.rd);
    expect(q.forward).toBeLessThan(q.spot);
    expect(q.T).toBeCloseTo(183 / 365, 12);
  });

  it("with equal flat rates on both legs, forward = spot", () => {
    const flat = daily("2020-01-01", Array(1000).fill(0.02));
    const q = priceForward(
      {
        fx: daily("2020-01-01", Array(1000).fill(1.35)),
        sgdOvernight: flat,
        foreignOvernight: flat,
        foreignBasis: 365,
      },
      "2021-06-01",
      "2021-12-01",
    );
    expect(q.forward).toBeCloseTo(1.35, 12);
  });
});
