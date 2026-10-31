// How many past periods the replay will test, counted before it runs, for the
// "Checking N comparable past periods…" progress line.

import { addDays, daysBetween } from "@/engine/calendar.ts";
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
