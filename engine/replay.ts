// Historical replay: run every strategy over every past window with the same
// length as the user's scenario, and summarise the spread of outcomes.

import { addDays, daysBetween, rateAsOf } from "./calendar.ts";
import { summarize, type Summary } from "./stats.ts";
import { runAll } from "./strategies.ts";
import {
  STRATEGY_IDS,
  type ISODate,
  type Scenario,
  type Series,
  type StrategyId,
  type StrategyResult,
} from "./types.ts";

export type ReplayOptions = {
  /**
   * The target strategy's target as a fraction below the spot on each
   * window's start date (0.02 = "2% better than spot"), so targets are
   * comparable across history.
   */
  targetBelowSpot: number;
  /** Ignore start dates before this (e.g. to align with rate data). */
  earliestStart?: ISODate;
};

export type StrategyStats = {
  /** SGD cost for the user's amount, rescaled to today's spot. */
  summary: Summary;
  /** Share of windows where this strategy cost strictly less than lump sum. */
  beatLumpSum: number;
};

export type ReplayResult = {
  windowDays: number;
  windows: number;
  /** Roughly how many non-overlapping windows the history contains. */
  independentWindows: number;
  firstStart: ISODate;
  lastStart: ISODate;
  /** Share of windows in which the target rate was reached before the deadline. */
  targetHitShare: number;
  /** Spot used to rescale outcomes: latest rate on or before the scenario start. */
  referenceSpot: number;
  referenceDate: ISODate;
  startDates: ISODate[];
  /**
   * Cost per window relative to that window's starting spot:
   * totalSgd / (amount × spot on start date). Lump sum = 1 + spread.
   */
  relativeCosts: Record<StrategyId, number[]>;
  stats: Record<StrategyId, StrategyStats>;
};

/**
 * Normalisation: a window that started in 1999 at 1.70 SGD/USD and one that
 * started in 2024 at 1.34 aren't comparable in raw SGD. Each window's cost is
 * divided by its own starting spot, then multiplied by the user's amount and
 * today's spot. So every outcome reads as "what this would cost if the next
 * months moved like that window did, starting from today's rate".
 */
export function replay(
  fx: Series,
  scenario: Scenario,
  opts: ReplayOptions,
): ReplayResult {
  const L = daysBetween(scenario.startDate, scenario.deadline);
  if (L <= 0) throw new Error("deadline must be after start date");
  const lastDate = fx.dates.at(-1)!;
  const reference = rateAsOf(fx, scenario.startDate);

  const startDates: ISODate[] = [];
  const relativeCosts = Object.fromEntries(
    STRATEGY_IDS.map((id) => [id, [] as number[]]),
  ) as Record<StrategyId, number[]>;

  let targetHits = 0;
  for (let i = 0; i < fx.dates.length; i++) {
    const d = fx.dates[i]!;
    if (opts.earliestStart && d < opts.earliestStart) continue;
    const deadline = addDays(d, L);
    if (deadline > lastDate) break; // the window must fit inside the data
    const spot = fx.values[i]!;
    const shifted = shiftScenario(scenario, d, deadline, spot, opts);
    const results = runAll(fx, shifted);
    if (results.target.conversions[0]!.rate <= shifted.targetRate!) {
      targetHits++;
    }
    startDates.push(d);
    for (const id of STRATEGY_IDS) {
      relativeCosts[id].push(results[id].totalSgd / (scenario.amount * spot));
    }
  }
  if (startDates.length === 0) {
    throw new Error("History is shorter than the scenario window");
  }

  const scale = scenario.amount * reference.value;
  const lump = relativeCosts.lumpSum;
  const stats = Object.fromEntries(
    STRATEGY_IDS.map((id) => {
      const costs = relativeCosts[id];
      const beat = costs.filter((c, j) => c < lump[j]! - 1e-12).length;
      return [
        id,
        {
          summary: summarize(costs.map((c) => c * scale)),
          beatLumpSum: beat / costs.length,
        },
      ];
    }),
  ) as Record<StrategyId, StrategyStats>;

  const first = startDates[0]!;
  const last = startDates.at(-1)!;
  return {
    windowDays: L,
    windows: startDates.length,
    independentWindows: Math.max(
      1,
      Math.floor((daysBetween(first, last) + L) / L),
    ),
    firstStart: first,
    lastStart: last,
    targetHitShare: targetHits / startDates.length,
    referenceSpot: reference.value,
    referenceDate: reference.date,
    startDates,
    relativeCosts,
    stats,
  };
}

/** The user's scenario moved to start on `start`, with a spot-relative target. */
export function shiftScenario(
  scenario: Scenario,
  start: ISODate,
  deadline: ISODate,
  spot: number,
  opts: Pick<ReplayOptions, "targetBelowSpot">,
): Scenario {
  return {
    ...scenario,
    startDate: start,
    deadline,
    targetRate: spot * (1 - opts.targetBelowSpot),
  };
}

/**
 * One historical window in full, for the "sample path" view: the scenario
 * replayed from `start`, with every conversion each strategy made.
 */
export function sampleWindow(
  fx: Series,
  scenario: Scenario,
  start: ISODate,
  opts: Pick<ReplayOptions, "targetBelowSpot">,
): {
  start: ISODate;
  deadline: ISODate;
  spot: number;
  results: Record<StrategyId, StrategyResult>;
} {
  const L = daysBetween(scenario.startDate, scenario.deadline);
  const spot = rateAsOf(fx, start);
  const deadline = addDays(spot.date, L);
  return {
    start: spot.date,
    deadline,
    spot: spot.value,
    results: runAll(
      fx,
      shiftScenario(scenario, spot.date, deadline, spot.value, opts),
    ),
  };
}
