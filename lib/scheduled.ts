// The date each conversion was scheduled for. The engine records the date
// whose rate was used: the scheduled date, or the next published rate when
// that day had none (a weekend or holiday). This reads the schedule back
// from the same rules, for labels only; the convention doesn't change.

import { trancheDates } from "@/engine/calendar.ts";
import type { ISODate, StrategyId, StrategyResult } from "@/engine/types.ts";

type Window = {
  start: ISODate;
  deadline: ISODate;
  results: Record<StrategyId, StrategyResult>;
};

/**
 * One scheduled date per conversion, in the same order:
 * - all at once: the start;
 * - equal tranches: the evenly spaced dates;
 * - wait until deadline: the deadline;
 * - target rate: the day the target was reached (a published rate, so no
 *   schedule of its own), else the deadline.
 */
export function scheduledDates(
  w: Window,
  tranches: number,
): Record<StrategyId, ISODate[]> {
  const target = w.results.target.conversions[0]!.date;
  return {
    lumpSum: [w.start],
    tranches: trancheDates(w.start, w.deadline, tranches),
    wait: [w.deadline],
    target: [target <= w.deadline ? target : w.deadline],
  };
}
