// Which plans the data can answer. The engine throws on a date it has no
// rate for; these checks run first, so the page explains the limit next to
// the field instead of failing to render.

import {
  addDays,
  addMonths,
  daysBetween,
  indexOnOrAfter,
  isWeekend,
  rateAsOf,
} from "@/engine/calendar.ts";
import type { ISODate, Series } from "@/engine/types.ts";
import { formatDate } from "./dates.ts";

/** Shortest plan, in calendar days. */
export const MIN_WINDOW_DAYS = 7;
/** Longest plan: three calendar years (1,096 days across a leap year). */
export const MAX_WINDOW_MONTHS = 36;
/** How far ahead a plan may start. Further out, nothing here is known. */
export const MAX_START_AHEAD_DAYS = 365;
/** Conversions are at least this many calendar days apart (see maxTranches). */
const MIN_TRANCHE_GAP_DAYS = 3;
export const MAX_TRANCHES = 24;

export function latestDeadline(start: ISODate): ISODate {
  return addMonths(start, MAX_WINDOW_MONTHS);
}

export function latestStart(today: ISODate): ISODate {
  return addDays(today, MAX_START_AHEAD_DAYS);
}

/** Why a start → deadline pair can't be a plan, or undefined if it can. */
export function windowError(
  start: ISODate,
  deadline: ISODate,
): string | undefined {
  if (daysBetween(start, deadline) < MIN_WINDOW_DAYS)
    return "The deadline must be at least a week after the start.";
  if (deadline > latestDeadline(start))
    return "Keep the deadline within 3 years of the start.";
  return undefined;
}

/**
 * Most conversions a plan can hold. Dates are spaced evenly in calendar
 * days and each moves to the next trading day, so two dates closer than
 * 3 days apart (a Saturday and a Sunday) could land on the same Monday.
 * At 3 days or more apart they never do, whatever weekday the plan starts.
 */
export function maxTranches(start: ISODate, deadline: ISODate): number {
  const days = Math.max(0, daysBetween(start, deadline));
  return Math.max(
    1,
    Math.min(MAX_TRANCHES, Math.floor(days / MIN_TRANCHE_GAP_DAYS) + 1),
  );
}

export function tranchesRange(start: ISODate, deadline: ISODate): string {
  const max = maxTranches(start, deadline);
  return max < MAX_TRANCHES
    ? `Enter a whole number from 1 to ${max}: conversions are at least 3 days apart, and this plan is ${daysBetween(start, deadline)} days long.`
    : `Enter a whole number from 1 to ${MAX_TRANCHES}.`;
}

export type StartIssue = {
  message: string;
  /** The nearest start that works: the data's first day, or today. */
  suggestedStart: ISODate;
};

/**
 * Why the planner can't start on `start` with this rate history, or
 * undefined if it can. `code` names the currency in the message.
 */
export function startDateIssue(
  start: ISODate,
  fx: Series,
  code: string,
  today: ISODate,
): StartIssue | undefined {
  const first = fx.dates[0]!;
  if (start < first)
    return {
      message: `${code} data starts ${formatDate(first)}. Pick a start on or after that date.`,
      suggestedStart: first,
    };
  const max = latestStart(today);
  if (start > max)
    return {
      message: `Pick a start within a year from today, on or before ${formatDate(max)}.`,
      suggestedStart: today,
    };
  return undefined;
}

export type HedgeIssue = { message: string; earliestStart?: ISODate };

/**
 * Why Hedging can't price this plan, or undefined if it can. The forward
 * compounds SORA and fed funds over the same length of time as the plan,
 * ending on the pricing date, and the option needs `volLookback` trading
 * days of rates before it. `ratesFirst` is the later of the two
 * interest-rate series' first dates.
 */
export function hedgeIssue(
  fx: Series,
  ratesFirst: ISODate,
  start: ISODate,
  deadline: ISODate,
  volLookback: number,
): HedgeIssue | undefined {
  if (start < fx.dates[0]!) return undefined; // reported by startDateIssue
  const pricing = rateAsOf(fx, start).date;
  if (deadline > latestDeadline(pricing))
    return {
      message: `Hedging prices from the latest rates (${formatDate(pricing)}), so keep the deadline within 3 years of that date.`,
    };
  const tenor = daysBetween(pricing, deadline);
  const vol = volHistoryOk(fx, pricing, volLookback);
  if (addDays(pricing, -tenor) >= ratesFirst && vol) return undefined;
  // The first start, keeping the plan's length, that both checks accept.
  const length = daysBetween(start, deadline);
  let s = addDays(ratesFirst, length);
  for (let i = 0; i < 31; i++, s = addDays(s, 1)) {
    if (isWeekend(s)) continue;
    const p = rateAsOf(fx, s).date;
    const t = daysBetween(p, addDays(s, length));
    if (addDays(p, -t) >= ratesFirst && volHistoryOk(fx, p, volLookback)) break;
  }
  return {
    message: `Hedging compounds interest rates over the ${length} days before the start, and SGD rates (SORA) begin on ${formatDate(ratesFirst)}. Pick a start on or after ${formatDate(s)}.`,
    earliestStart: s,
  };
}

function volHistoryOk(fx: Series, pricing: ISODate, lookback: number) {
  let end = indexOnOrAfter(fx, pricing);
  if (end === -1) end = fx.dates.length;
  return end - lookback - 1 >= 0;
}
