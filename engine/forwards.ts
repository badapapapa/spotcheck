// FX forwards by covered interest parity.

import { daysBetween, rateAsOf } from "./calendar.ts";
import { trailingCompoundedRate } from "./rates.ts";
import type { ISODate, Series } from "./types.ts";

/**
 * Covered interest parity with simple interest (fine for T ≤ 1 year):
 *
 *   F = S0 × (1 + r_d × T) / (1 + r_f × T)
 *
 * S0 in SGD per foreign unit, r_d the SGD rate, r_f the foreign rate (both
 * simple, ACT/365), T in years. If SGD rates are higher than foreign rates,
 * the forward is above spot.
 */
export function forwardRate(
  S0: number,
  rd: number,
  rf: number,
  T: number,
): number {
  if (T < 0) throw new Error("T must be non-negative");
  return (S0 * (1 + rd * T)) / (1 + rf * T);
}

/** Forward points: F − S0, in SGD per foreign unit. */
export function forwardPoints(S0: number, F: number): number {
  return F - S0;
}

export type ForwardQuote = {
  date: ISODate; // pricing date
  deadline: ISODate;
  T: number; // years, ACT/365
  spot: number;
  spotDate: ISODate;
  rd: number; // SGD rate used (simple, ACT/365)
  rf: number; // foreign rate used (simple, ACT/365)
  ratesAsOf: ISODate; // last day of the compounding window, exclusive
  forward: number;
  points: number;
};

export type RateInputs = {
  fx: Series;
  sgdOvernight: Series; // daily SORA, value-dated
  foreignOvernight: Series; // e.g. daily USD fed funds, value-dated
  foreignBasis: 365 | 360; // USD money-market rates are ACT/360
};

/**
 * Prices a forward on `date` for delivery on `deadline` using only data
 * known on `date`:
 * - spot: the latest FX rate on or before `date`;
 * - r_d, r_f: overnight rates compounded over the tenor-length window ending
 *   on `date` (backward-looking proxy for the term rate; real dealers use
 *   forward-looking term rates, so this is an approximation).
 */
export function priceForward(
  inputs: RateInputs,
  date: ISODate,
  deadline: ISODate,
): ForwardQuote {
  const tenorDays = daysBetween(date, deadline);
  if (tenorDays <= 0) throw new Error("deadline must be after date");
  const T = tenorDays / 365;
  const spot = rateAsOf(inputs.fx, date);
  const rd = trailingCompoundedRate(inputs.sgdOvernight, date, tenorDays, 365);
  const rf = trailingCompoundedRate(
    inputs.foreignOvernight,
    date,
    tenorDays,
    inputs.foreignBasis,
  );
  const forward = forwardRate(spot.value, rd, rf, T);
  return {
    date,
    deadline,
    T,
    spot: spot.value,
    spotDate: spot.date,
    rd,
    rf,
    ratesAsOf: date,
    forward,
    points: forwardPoints(spot.value, forward),
  };
}

/** SGD cost of locking a forward for `amount` units: fixed on the pricing date. */
export function forwardHedgeCost(
  amount: number,
  forward: number,
  spread: number,
): number {
  return amount * forward * (1 + spread);
}
