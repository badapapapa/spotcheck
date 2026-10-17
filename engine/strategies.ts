// The four planner strategies. Each returns every conversion it made and the
// total SGD paid, including the conversion spread:
//   sgd = units × rate × (1 + spread)

import { indexOnOrAfter, rateOn, trancheDates } from "./calendar.ts";
import type {
  Conversion,
  ISODate,
  Scenario,
  Series,
  StrategyId,
  StrategyResult,
} from "./types.ts";

function convert(
  fx: Series,
  date: ISODate,
  units: number,
  spread: number,
): Conversion {
  const { date: tradeDate, value: rate } = rateOn(fx, date);
  return { date: tradeDate, units, rate, sgd: units * rate * (1 + spread) };
}

function result(
  strategy: StrategyId,
  conversions: Conversion[],
): StrategyResult {
  const totalSgd = conversions.reduce((sum, c) => sum + c.sgd, 0);
  return { strategy, conversions, totalSgd };
}

/** Convert everything on the start date. */
export function lumpSum(fx: Series, s: Scenario): StrategyResult {
  return result("lumpSum", [convert(fx, s.startDate, s.amount, s.spread)]);
}

/** amount / k units on each of k evenly spaced dates. */
export function tranches(fx: Series, s: Scenario): StrategyResult {
  const k = s.tranches;
  const units = s.amount / k;
  return result(
    "tranches",
    trancheDates(s.startDate, s.deadline, k).map((d) =>
      convert(fx, d, units, s.spread),
    ),
  );
}

/** Convert everything on the deadline. */
export function wait(fx: Series, s: Scenario): StrategyResult {
  return result("wait", [convert(fx, s.deadline, s.amount, s.spread)]);
}

/**
 * Convert everything on the first day the rate is at or below the target,
 * otherwise on the deadline. Each day's decision looks only at that day's
 * rate, so there is no look-ahead.
 */
export function target(fx: Series, s: Scenario): StrategyResult {
  if (s.targetRate === undefined) throw new Error("target needs targetRate");
  const start = indexOnOrAfter(fx, s.startDate);
  if (start !== -1) {
    for (
      let i = start;
      i < fx.dates.length && fx.dates[i]! <= s.deadline;
      i++
    ) {
      if (fx.values[i]! <= s.targetRate) {
        return result("target", [
          convert(fx, fx.dates[i]!, s.amount, s.spread),
        ]);
      }
    }
  }
  return result("target", [convert(fx, s.deadline, s.amount, s.spread)]);
}

export const STRATEGIES: Record<
  StrategyId,
  (fx: Series, s: Scenario) => StrategyResult
> = { lumpSum, tranches, wait, target };

export const STRATEGY_LABELS: Record<StrategyId, string> = {
  lumpSum: "Convert all at once",
  tranches: "Equal tranches",
  wait: "Wait until deadline",
  target: "Target rate, else deadline",
};

export function runAll(
  fx: Series,
  s: Scenario,
): Record<StrategyId, StrategyResult> {
  return {
    lumpSum: lumpSum(fx, s),
    tranches: tranches(fx, s),
    wait: wait(fx, s),
    target: target(fx, s),
  };
}
