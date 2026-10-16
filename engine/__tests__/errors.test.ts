import { describe, expect, it } from "vitest";
import { toEpochDay } from "../calendar.ts";
import { forwardRate, priceForward } from "../forwards.ts";
import { hedgeReplay } from "../hedge-replay.ts";
import { compoundedRate, toContinuous } from "../rates.ts";
import { replay } from "../replay.ts";
import { percentile, realisedVol } from "../stats.ts";
import { target } from "../strategies.ts";
import { baseScenario, daily } from "./helpers.ts";

// Bad inputs fail loudly instead of producing a plausible-looking number.
describe("input errors", () => {
  const fx = daily("2024-01-01", Array(30).fill(1.35));

  it("calendar rejects invalid dates", () => {
    expect(() => toEpochDay("2024-13-45")).toThrow();
  });

  it("stats reject empty input, bad p and short history", () => {
    expect(() => percentile([], 0.5)).toThrow();
    expect(() => percentile([1], 1.5)).toThrow();
    expect(() => realisedVol(fx, "2024-01-10", 60)).toThrow(
      /Not enough history/,
    );
  });

  it("rates reject empty windows, missing history and T ≤ 0", () => {
    expect(() => compoundedRate(fx, "2024-01-05", "2024-01-05")).toThrow();
    expect(() => compoundedRate(fx, "2023-01-01", "2024-01-05")).toThrow();
    expect(() => toContinuous(0.03, 0)).toThrow();
  });

  it("target needs a target rate", () => {
    expect(() =>
      target(fx, { ...baseScenario, targetRate: undefined }),
    ).toThrow();
  });

  it("forwards reject negative T and deadlines before the pricing date", () => {
    expect(() => forwardRate(1.35, 0.03, 0.03, -1)).toThrow();
    const inputs = {
      fx,
      sgdOvernight: fx,
      foreignOvernight: fx,
      foreignBasis: 365 as const,
    };
    expect(() => priceForward(inputs, "2024-01-20", "2024-01-10")).toThrow();
  });

  it("replays reject windows longer than the history", () => {
    const s = {
      ...baseScenario,
      startDate: "2024-01-01",
      deadline: "2025-01-01",
    };
    expect(() => replay(fx, s, { targetBelowSpot: 0.02 })).toThrow();
    expect(() =>
      replay(fx, { ...s, deadline: "2023-01-01" }, { targetBelowSpot: 0.02 }),
    ).toThrow();
    const inputs = {
      fx,
      sgdOvernight: fx,
      foreignOvernight: fx,
      foreignBasis: 365 as const,
    };
    expect(() => hedgeReplay(inputs, s, 1.35)).toThrow();
  });
});
