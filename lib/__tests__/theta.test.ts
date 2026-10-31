// The Hedging page shows theta for the user's amount per day. With USD
// interest rates above SGD rates, theta on a USD call is positive: as time
// passes the forward (below spot) drifts up toward spot, which adds value.
// These tests pin that sign so the "What is theta?" note stays true.

import { describe, expect, it } from "vitest";
import { gkCallGreeks } from "@/engine/options.ts";

// The USD scenario in the review: spot 1.2792, at-the-money strike,
// continuously compounded SGD 1.13% and USD 3.70%, 0.792 years, 3.5% vol.
const carry = {
  S: 1.2792,
  K: 1.2792,
  rd: 0.0113,
  rf: 0.037,
  T: 0.792,
  sigma: 0.035,
};
const perDay = (theta: number) => (theta * 15_000) / 365;

describe("theta for a USD call with SGD rates below USD rates", () => {
  it("is positive at the money (about +S$0.02 a day for 15,000 USD)", () => {
    const t = perDay(gkCallGreeks(carry).theta);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeCloseTo(0.02, 2);
  });

  it("is larger in the money (about +S$1.6 a day at 115% of the strike)", () => {
    const t = perDay(gkCallGreeks({ ...carry, S: 1.15 * carry.K }).theta);
    expect(t).toBeGreaterThan(1.5);
    expect(t).toBeLessThan(1.7);
  });

  it("turns negative when the carry reverses (SGD rates above USD rates)", () => {
    const t = perDay(gkCallGreeks({ ...carry, rd: 0.037, rf: 0.0113 }).theta);
    expect(t).toBeLessThan(0);
  });
});
