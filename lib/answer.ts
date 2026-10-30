// The planner's headline: which strategy had the lowest median cost in the
// replay, and by how much. Everything here is read from the engine's
// ReplayResult; nothing is estimated. It states what happened in the past
// and never says what anyone should do (CLAUDE.md rule 3).

import { addDays, daysBetween } from "@/engine/calendar.ts";
import type { ReplayResult } from "@/engine/replay.ts";
import {
  STRATEGY_IDS,
  type Scenario,
  type Series,
  type StrategyId,
} from "@/engine/types.ts";
import { formatSgd } from "./format.ts";

export type HistoricalAnswer = {
  /** Strategy with the lowest median cost (first in STRATEGY_IDS on a tie). */
  lowest: StrategyId;
  /**
   * What it is compared with: converting all at once, or, when all at once
   * is itself the lowest, the strategy with the next-lowest median.
   */
  reference: StrategyId;
  /** reference median − lowest median, in SGD (never negative). */
  medianGap: number;
  /** Windows where `lowest` cost strictly less than `reference`. */
  cheaperWindows: number;
  windows: number;
  /**
   * The strategy whose worst case it is compared with: always `reference`,
   * so all three figures compare the same pair and a lower median can't be
   * shown next to a flattering, different downside comparison.
   */
  worstReference: StrategyId;
  /** worstReference's worst case − lowest's worst case. Negative = lowest's is higher. */
  worstGap: number;
  /**
   * True when the lowest median is within a rounding of the reference's
   * (e.g. the BND peg, where every strategy costs the same).
   */
  noClearLowest: boolean;
};

export function historicalAnswer(r: ReplayResult): HistoricalAnswer {
  const median = (id: StrategyId) => r.stats[id].summary.median;
  // Strict "<", so ties go to the strategy listed first.
  const byMedian = [...STRATEGY_IDS].sort(
    (a, b) =>
      median(a) - median(b) ||
      STRATEGY_IDS.indexOf(a) - STRATEGY_IDS.indexOf(b),
  );
  const lowest = byMedian[0]!;
  const reference = lowest === "lumpSum" ? byMedian[1]! : "lumpSum";
  const medianGap = median(reference) - median(lowest);

  const a = r.relativeCosts[lowest];
  const b = r.relativeCosts[reference];
  const cheaperWindows = a.filter((c, i) => c < b[i]! - 1e-12).length;

  const worstReference = reference;
  const worstGap =
    r.stats[worstReference].summary.max - r.stats[lowest].summary.max;

  return {
    lowest,
    reference,
    medianGap,
    cheaperWindows,
    windows: r.windows,
    worstReference,
    worstGap,
    // "S$0" (or "S$0.00") once rounded for display: no visible difference.
    noClearLowest: /^S\$0(\.00)?$/.test(formatSgd(medianGap)),
  };
}

/**
 * How many past windows the replay will test, counted before it runs, for
 * the "Checking N comparable past periods…" progress line. Same rule as the
 * engine: every observation whose window still ends inside the data.
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
