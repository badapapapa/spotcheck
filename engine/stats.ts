// Descriptive statistics for replay outcomes, and realised volatility.

import { indexOnOrAfter, daysBetween } from "./calendar.ts";
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

export type VolEstimate = {
  sigma: number; // annualised
  observations: number; // log returns used
  from: ISODate;
  to: ISODate; // last observation used, strictly before the pricing date
};

/**
 * Annualised realised volatility of daily log returns over the `lookback`
 * observations strictly before `pricingDate`, so the window being priced is
 * never used (no look-ahead).
 *
 * Annualisation uses the observed frequency (returns per year over the
 * lookback's calendar span), which works whether or not the series includes
 * weekends.
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
  for (let i = start + 1; i < end; i++) {
    returns.push(Math.log(fx.values[i]! / fx.values[i - 1]!));
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const from = fx.dates[start]!;
  const to = fx.dates[end - 1]!;
  const perYear = returns.length / (daysBetween(from, to) / 365);
  return {
    sigma: Math.sqrt(variance * perYear),
    observations: returns.length,
    from,
    to,
  };
}
