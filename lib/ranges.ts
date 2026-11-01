// The timeline's range buttons (1Y / 5Y / 10Y / All). Display only: they
// choose which past periods the chart draws; the results and the
// selection's index always cover every period.

import { toEpochDay } from "@/engine/calendar.ts";
import { formatMonth } from "./dates.ts";
import { addMonths } from "./periods.ts";

export type RangeId = "1y" | "5y" | "10y" | "all";

export const RANGES: readonly {
  id: RangeId;
  label: string;
  /** Read after the label by screen readers: "1Y (last year)". */
  spoken: string;
  years?: number;
}[] = [
  { id: "1y", label: "1Y", spoken: "last year", years: 1 },
  { id: "5y", label: "5Y", spoken: "last 5 years", years: 5 },
  { id: "10y", label: "10Y", spoken: "last 10 years", years: 10 },
  { id: "all", label: "All", spoken: "every period" },
];

/** First and last period index shown, inclusive. */
export type Visible = { from: number; to: number };

/**
 * The periods whose start lies within the range of the latest period's
 * start (the chart's right edge, not today). Start dates are ISO strings,
 * so they compare in date order as text.
 */
export function visibleRange(
  startDates: readonly string[],
  range: RangeId,
): Visible {
  const to = startDates.length - 1;
  const years = RANGES.find((r) => r.id === range)?.years;
  if (years === undefined || to < 0) return { from: 0, to };
  const cutoff = addMonths(startDates[to]!, -12 * years);
  let lo = 0;
  let hi = to;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (startDates[mid]! < cutoff) lo = mid + 1;
    else hi = mid;
  }
  return { from: lo, to };
}

/**
 * A range is offered only when it is shorter than the history; otherwise
 * it would draw the same chart as All.
 */
export function rangeAvailable(
  startDates: readonly string[],
  range: RangeId,
): boolean {
  const years = RANGES.find((r) => r.id === range)?.years;
  if (years === undefined) return true;
  const last = startDates.at(-1);
  return last !== undefined && addMonths(last, -12 * years) > startDates[0]!;
}

/** An index moved inside the visible range (the nearest visible period). */
export function clampTo(index: number, { from, to }: Visible): number {
  return Math.min(to, Math.max(from, index));
}

export type Tick = { day: number; label: string };

/**
 * Ticks for the chart's time axis between two start dates, at most one per
 * `minGap` pixels across `width`. Over two years: 1 January of each year
 * (or every 2nd, 5th… year). Two years or less: the 1st of the month, every
 * 1, 2, 3, 4, 6 or 12 months, aligned so January is always one of them.
 */
export function timeTicks(
  first: string,
  last: string,
  width: number,
  minGap = 80,
): Tick[] {
  const room = Math.max(1, Math.floor(width / minGap));
  const [y0, m0] = first.split("-").map(Number) as [number, number];
  const [y1, m1] = last.split("-").map(Number) as [number, number];
  const days = toEpochDay(last) - toEpochDay(first);
  if (days > 2 * 366) {
    const count = y1 - y0;
    const step = Math.max(1, Math.ceil(count / room));
    const out: Tick[] = [];
    for (let yr = y0 + 1; yr <= y1; yr += step)
      out.push({ day: toEpochDay(`${yr}-01-01`), label: String(yr) });
    return out;
  }
  // Month starts strictly after `first`, up to `last`.
  const startIndex = y0 * 12 + m0; // the month after first's (0-based + 1)
  const endIndex = y1 * 12 + (m1 - 1);
  const count = endIndex - startIndex + 1;
  const step =
    [1, 2, 3, 4, 6, 12].find((s) => Math.ceil(count / s) <= room) ?? 12;
  const out: Tick[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    if ((i % 12) % step) continue;
    const date = `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`;
    out.push({ day: toEpochDay(date), label: formatMonth(date) });
  }
  return out;
}
