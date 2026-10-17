// Descriptive statistics for replay outcomes, and realised volatility.

import { indexOnOrAfter, isWeekend } from "./calendar.ts";
import type { ISODate, Series } from "./types.ts";

/**
 * Percentile of an ascending-sorted array by linear interpolation between
 * closest ranks (the same as numpy's default and Excel's PERCENTILE.INC).
 * `p` is in [0, 1].
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error("percentile of empty array");
  if (p < 0 || p > 1) throw new Error(`p must be in [0, 1], got ${p}`);
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo]!;
  const b = sorted[hi]!;
  return a + (b - a) * (pos - lo);
}

export type Summary = {
  count: number;
  min: number;
  p5: number;
  median: number;
  p95: number;
  max: number;
  mean: number;
};

export function summarize(values: readonly number[]): Summary {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted[0]!,
    p5: percentile(sorted, 0.05),
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1)!,
    mean: sorted.reduce((s, v) => s + v, 0) / sorted.length,
  };
}

/** Trading days per year used to annualise daily volatility. */
export const TRADING_DAYS_PER_YEAR = 252;

export type VolEstimate = {
  sigma: number; // annualised
  observations: number; // log returns used (= trading days)
  from: ISODate;
  to: ISODate; // last observation used, strictly before the pricing date
};

/**
 * Annualised realised volatility: the sample standard deviation of log
 * returns between consecutive trading observations, over the `lookback`
 * trading days strictly before `pricingDate` (no look-ahead), times √252.
 *
 * The series must hold trading observations only. A weekend row would add a
 * near-zero "move" and dilute the estimate, so it is rejected outright.
 */
export function realisedVol(
  fx: Series,
  pricingDate: ISODate,
  lookback: number,
): VolEstimate {
  let end = indexOnOrAfter(fx, pricingDate);
  if (end === -1) end = fx.dates.length; // all data is before pricingDate
  const start = end - lookback - 1; // lookback returns need lookback+1 prices
  if (start < 0) throw new Error(`Not enough history before ${pricingDate}`);
  const returns: number[] = [];
  for (let i = start; i < end; i++) {
    if (isWeekend(fx.dates[i]!)) {
      throw new Error(
        `realisedVol needs trading observations; ${fx.dates[i]} is a weekend`,
      );
    }
    if (i > start) returns.push(Math.log(fx.values[i]! / fx.values[i - 1]!));
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return {
    sigma: Math.sqrt(variance * TRADING_DAYS_PER_YEAR),
    observations: returns.length,
    from: fx.dates[start]!,
    to: fx.dates[end - 1]!,
  };
}
