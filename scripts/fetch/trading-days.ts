// Which FX rows are real trading observations.
//
// Frankfurter's blended feed has rows for Saturdays and Sundays (from sources
// that publish at weekends) and occasionally repeats the previous rate over a
// holiday. Neither is a day the SGD FX market traded. Keeping them made a
// year about 365 "observations" instead of about 252, which inflated window
// counts and diluted realised volatility with near-zero weekend moves.

import type { FxRow } from "./schemas.ts";

/** Saturday or Sunday, from the ISO date alone (UTC, no time zones). */
export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Keeps Monday–Friday rows. With `dropRepeats` (the blended feed), a rate
 * that exactly repeats the previous kept row is treated as carried forward
 * and dropped. ECB reference rates are fixed afresh every TARGET day, so an
 * equal value there is a real observation and is kept.
 */
export function tradingObservations(
  rows: readonly FxRow[],
  { dropRepeats = true } = {},
): FxRow[] {
  const out: FxRow[] = [];
  for (const row of rows) {
    if (isWeekend(row[0])) continue;
    if (dropRepeats && out.length > 0 && out.at(-1)![1] === row[1]) continue;
    out.push(row);
  }
  return out;
}
