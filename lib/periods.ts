// How many past periods the replay will test, counted before it runs, for the
// "Checking N comparable past periods…" progress line.

import { addDays, daysBetween, toEpochDay } from "@/engine/calendar.ts";
import type { Scenario, Series } from "@/engine/types.ts";

/**
 * Same rule as the engine: every observation whose window still ends inside
 * the data. A test checks it against the replay's own count.
 */
export function windowCount(fx: Series, scenario: Scenario): number {
  const L = daysBetween(scenario.startDate, scenario.deadline);
  const last = fx.dates.at(-1)!;
  let n = 0;
  for (const d of fx.dates) {
    if (addDays(d, L) > last) break;
    n++;
  }
  return n;
}

/** The same calendar day `months` months away, clamped to the month's end. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  // Day 0 of the next month is the last day of this one (UTC, no local time).
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`;
}

/**
 * The period one month earlier (-1) or later (+1) than `index`: the same
 * calendar day a month away, or the nearest start date to it when that day
 * had no published rate. Stays put at either end of the history.
 */
export function stepMonth(
  startDates: string[],
  index: number,
  direction: -1 | 1,
): number {
  const target = toEpochDay(addMonths(startDates[index]!, direction));
  const days = startDates.map((d) => toEpochDay(d));
  if (direction < 0 && target < days[0]!) return index;
  if (direction > 0 && target > days.at(-1)!) return index;
  let nearest = 0;
  for (let i = 1; i < days.length; i++)
    if (Math.abs(days[i]! - target) < Math.abs(days[nearest]! - target))
      nearest = i;
  return nearest;
}
