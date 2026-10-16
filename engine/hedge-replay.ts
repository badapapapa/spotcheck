// Historical comparison of hedges: for every past window of the scenario's
// length, what waiting (unhedged), locking a forward on day one, and (when
// option settings are given) buying a call on day one would have cost.

import { addDays, daysBetween, rateOn } from "./calendar.ts";
import { forwardHedgeCost, priceForward, type RateInputs } from "./forwards.ts";
import { summarize, type Summary } from "./stats.ts";
import type { ISODate, Scenario } from "./types.ts";

export type HedgeId = "unhedged" | "forward" | "option";

/** Prices an option hedge for one window; supplied by options.ts. */
export type OptionPricer = (args: {
  date: ISODate;
  deadline: ISODate;
  spot: number;
  rd: number;
  rf: number;
}) => { premium: number; strike: number };

export type HedgeReplayResult = {
  windows: number;
  firstStart: ISODate;
  lastStart: ISODate;
  startDates: ISODate[];
  /** Cost relative to each window's starting spot (see replay.ts). */
  relativeCosts: Partial<Record<HedgeId, number[]>>;
  /** SGD for the user's amount, rescaled to the reference spot. */
  summaries: Partial<Record<HedgeId, Summary>>;
};

/** First date from which every input series covers a full lookback window. */
export function earliestHedgeStart(
  inputs: RateInputs,
  windowDays: number,
): ISODate {
  const firsts = [
    inputs.sgdOvernight.dates[0]!,
    inputs.foreignOvernight.dates[0]!,
  ].sort();
  return addDays(firsts.at(-1)!, windowDays);
}

export function hedgeReplay(
  inputs: RateInputs,
  scenario: Scenario,
  referenceSpot: number,
  optionPricer?: OptionPricer,
): HedgeReplayResult {
  const { fx } = inputs;
  const L = daysBetween(scenario.startDate, scenario.deadline);
  const earliest = earliestHedgeStart(inputs, L);
  const lastDate = fx.dates.at(-1)!;
  const lastRates = [
    inputs.sgdOvernight.dates.at(-1)!,
    inputs.foreignOvernight.dates.at(-1)!,
  ].sort()[0]!;

  const startDates: ISODate[] = [];
  const unhedged: number[] = [];
  const forward: number[] = [];
  const option: number[] = [];
  const c = scenario.spread;

  for (let i = 0; i < fx.dates.length; i++) {
    const d = fx.dates[i]!;
    if (d < earliest) continue;
    const deadline = addDays(d, L);
    if (deadline > lastDate || d > addDays(lastRates, 1)) break;
    const spot = fx.values[i]!;
    const settle = rateOn(fx, deadline).value; // S_T, rate on the deadline
    const q = priceForward(inputs, d, deadline);
    startDates.push(d);
    unhedged.push((settle * (1 + c)) / spot);
    forward.push(forwardHedgeCost(1, q.forward, c) / spot);
    if (optionPricer) {
      const { premium, strike } = optionPricer({
        date: d,
        deadline,
        spot,
        rd: q.rd,
        rf: q.rf,
      });
      // Premium paid upfront (its time value ignored); convert at the
      // cheaper of the market rate and the strike on the deadline.
      option.push((premium + Math.min(settle, strike) * (1 + c)) / spot);
    }
  }
  if (startDates.length === 0) {
    throw new Error("Not enough interest-rate history for this window length");
  }

  const scale = scenario.amount * referenceSpot;
  const relativeCosts: HedgeReplayResult["relativeCosts"] = {
    unhedged,
    forward,
  };
  if (optionPricer) relativeCosts.option = option;
  const summaries: HedgeReplayResult["summaries"] = {};
  for (const [id, costs] of Object.entries(relativeCosts) as [
    HedgeId,
    number[],
  ][]) {
    summaries[id] = summarize(costs.map((x) => x * scale));
  }
  return {
    windows: startDates.length,
    firstStart: startDates[0]!,
    lastStart: startDates.at(-1)!,
    startDates,
    relativeCosts,
    summaries,
  };
}
