// Which FX rows are real trading observations.
//
// Weekends: Frankfurter's blended feed has rows for Saturdays and Sundays
// (from banks that publish at weekends). Neither is a day the SGD FX market
// traded. Keeping them made a year about 365 "observations" instead of
// about 252, which inflated window counts and diluted realised volatility
// with near-zero weekend moves.
//
// Holidays: for a blended currency with a home bank (calendars.ts), a
// weekday row is dropped when the bank skipped that date but published a
// later one: a confirmed holiday, whatever the row's value. Every other
// weekday row is kept, so a real tie stays (ISK 95.95 on 13 and 16 Nov
// 2026). Days after the bank's latest published date can't be judged yet
// (some banks reach Frankfurter a day or more late); they are kept, and
// judged on a later night while still in the re-fetch window. ECB reference
// rates are fixed afresh every TARGET day, so every ECB weekday row is kept.

import type { Calendar } from "./calendars.ts";
import type { FxRow } from "./schemas.ts";

/** Saturday or Sunday, from the ISO date alone (UTC, no time zones). */
export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Keeps Monday–Friday rows. With a `calendar`, a row from `since` on (the
 * re-fetched days) is dropped if the home bank skipped its date between the
 * calendar's first and last dates. Rows before `since` (the committed
 * history), and rows outside the calendar's dates, are kept as they are.
 */
export function tradingObservations(
  rows: readonly FxRow[],
  { calendar, since = "" }: { calendar?: Calendar; since?: string } = {},
): FxRow[] {
  return rows.filter(([date]) => {
    if (isWeekend(date)) return false;
    if (!calendar || date < since) return true;
    if (date < calendar.first || date > calendar.last) return true;
    return calendar.dates.has(date);
  });
}
