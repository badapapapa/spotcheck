// Date arithmetic and rate lookups. Pure functions on ISO date strings:
// dates are parsed as UTC midnight only, never with local-time getters.

import type { ISODate, Series } from "./types.ts";

const DAY_MS = 86_400_000;

export function toEpochDay(date: ISODate): number {
  const ms = Date.parse(date + "T00:00:00Z");
  if (Number.isNaN(ms)) throw new Error(`Invalid date '${date}'`);
  return Math.round(ms / DAY_MS);
}

export function fromEpochDay(day: number): ISODate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Calendar days from `a` to `b` (negative if b is earlier). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return toEpochDay(b) - toEpochDay(a);
}

/** Years from `a` to `b` on an ACT/365 basis. */
export function yearFraction(a: ISODate, b: ISODate): number {
  return daysBetween(a, b) / 365;
}

/** Same day `months` later, clamped to the month's end (31 Jan + 1M = 28/29 Feb). */
export function addMonths(date: ISODate, months: number): ISODate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Index of the first observation on or after `date`, or -1 if none. */
export function indexOnOrAfter(series: Series, date: ISODate): number {
  const { dates } = series;
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (dates[mid]! < date) lo = mid + 1;
    else hi = mid;
  }
  return lo < dates.length ? lo : -1;
}

/** Index of the last observation on or before `date`, or -1 if none. */
export function indexOnOrBefore(series: Series, date: ISODate): number {
  const after = indexOnOrAfter(series, date);
  if (after === -1) return series.dates.length - 1;
  return series.dates[after] === date ? after : after - 1;
}

export type Observation = { date: ISODate; value: number };

/**
 * The rate you could trade at on `date`: that day's value, or the next
 * available one if there's none (weekends, holidays). Use for executing
 * conversions, never for decisions.
 */
export function rateOn(series: Series, date: ISODate): Observation {
  const i = indexOnOrAfter(series, date);
  if (i === -1) throw new Error(`No rate on or after ${date}`);
  return { date: series.dates[i]!, value: series.values[i]! };
}

/**
 * The latest value known on `date` (on or before it). Use for any decision
 * information, so nothing from the future leaks in.
 */
export function rateAsOf(series: Series, date: ISODate): Observation {
  const i = indexOnOrBefore(series, date);
  if (i === -1) throw new Error(`No rate on or before ${date}`);
  return { date: series.dates[i]!, value: series.values[i]! };
}

/**
 * `k` conversion dates spaced evenly in calendar days from `start` to
 * `deadline` inclusive. k = 1 gives just `start`. Dates are not snapped here;
 * `rateOn` snaps each to the next available rate when converting.
 */
export function trancheDates(
  start: ISODate,
  deadline: ISODate,
  k: number,
): ISODate[] {
  if (!Number.isInteger(k) || k < 1) throw new Error(`Bad tranche count ${k}`);
  if (k === 1) return [start];
  const span = daysBetween(start, deadline);
  return Array.from({ length: k }, (_, i) =>
    addDays(start, Math.round((i * span) / (k - 1))),
  );
}
