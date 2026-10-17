// Overnight-rate compounding (SORA, USD fed funds) and rate lookups.

import {
  addMonths,
  daysBetween,
  indexOnOrBefore,
  toEpochDay,
} from "./calendar.ts";
import type { ISODate, Series } from "./types.ts";

/**
 * Compounded overnight rate over [from, to), the MAS method:
 *
 *   r = (Π (1 + r_i × n_i / basis) − 1) × 365 / N
 *
 * r_i is the published rate for business day i, n_i the calendar days it
 * applies (a Friday rate usually covers 3 days), N the calendar days from
 * `from` to `to`. Each day in the window accrues at the latest rate published
 * for a business day on or before it, so a window may start or end on any day.
 *
 * `basis` is the rate's own day-count denominator: 365 for SORA, 360 for USD
 * fed funds. The result is always a simple annualised rate on ACT/365, the
 * convention the rest of the engine uses.
 */
export function compoundedRate(
  overnight: Series,
  from: ISODate,
  to: ISODate,
  basis: 365 | 360 = 365,
): number {
  const N = daysBetween(from, to);
  if (N <= 0) throw new Error(`Empty compounding window ${from} → ${to}`);
  let i = indexOnOrBefore(overnight, from);
  if (i === -1) throw new Error(`No rate on or before ${from}`);
  let growth = 1;
  let day = toEpochDay(from);
  const end = toEpochDay(to);
  while (day < end) {
    // The rate at index i applies until the next published date (or `to`).
    const next =
      i + 1 < overnight.dates.length
        ? toEpochDay(overnight.dates[i + 1]!)
        : end;
    const until = Math.min(next, end);
    const n = until - day;
    if (n > 0) growth *= 1 + (overnight.values[i]! * n) / basis;
    day = until;
    i++;
  }
  return ((growth - 1) * 365) / N;
}

/**
 * Backward-looking compounded rate for a tenor ending on `asOf`: the proxy
 * the engine uses for the term rate on that date. Real forwards use forward-
 * looking term rates, so this is an approximation (stated in the methodology).
 */
export function trailingCompoundedRate(
  overnight: Series,
  asOf: ISODate,
  tenorDays: number,
  basis: 365 | 360 = 365,
): number {
  const from = toIso(toEpochDay(asOf) - tenorDays);
  return compoundedRate(overnight, from, asOf, basis);
}

function toIso(day: number): ISODate {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Start date of a compounded-SORA tenor ending on `end` (e.g. 1M, 3M, 6M). */
export function tenorStart(end: ISODate, months: number): ISODate {
  return addMonths(end, -months);
}

/** Converts a simple rate over T years to its continuously compounded equivalent. */
export function toContinuous(simpleRate: number, T: number): number {
  if (T <= 0) throw new Error("T must be positive");
  return Math.log(1 + simpleRate * T) / T;
}
