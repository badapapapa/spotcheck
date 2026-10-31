import { describe, expect, it } from "vitest";
import { addDays, rateAsOf } from "@/engine/calendar.ts";
import { CURRENCIES } from "@/engine/currencies.ts";
import { replay } from "@/engine/replay.ts";
import { loadFx } from "@/engine/__tests__/helpers.ts";
import { formatSgd } from "../format.ts";
import { todayCost } from "../today-cost.ts";

describe("todayCost", () => {
  it("adds the spread on top of the mid-rate cost", () => {
    const c = todayCost({ amount: 1000, spread: 0.005 }, 1.3);
    expect(c.mid).toBeCloseTo(1300, 9);
    expect(c.withSpread).toBeCloseTo(1306.5, 9);
  });

  // The headline figure and the "All at once" row must never disagree, for
  // any currency, amount or spread a user might pick.
  it.each(CURRENCIES.map((c) => c.code))(
    "%s: shows the same figure as the All at once result",
    (code) => {
      const fx = loadFx(code);
      const startDate = fx.dates.at(-1)!;
      for (const [amount, spread] of [
        [15_000, 0.005],
        [3_333, 0.0125],
        [150, 0],
      ] as const) {
        const scenario = {
          currency: code,
          amount,
          startDate,
          // Relative to the data, so the test keeps working as new days arrive.
          deadline: addDays(startDate, 290),
          tranches: 6,
          spread,
        };
        const r = replay(fx, scenario, { targetBelowSpot: 0.02 });
        const spot = rateAsOf(fx, startDate).value;
        expect(formatSgd(todayCost(scenario, spot).withSpread)).toBe(
          formatSgd(r.stats.lumpSum.summary.median),
        );
      }
    },
  );
});
