// Converting the amount when someone switches currency, so the scenario keeps
// the same SGD value (15,000 USD ≈ S$19,200 ≈ 393,000,000 VND).

import { rateAsOf } from "@/engine/calendar.ts";
import type { Series } from "@/engine/types.ts";
import { LIMITS } from "./url-state.ts";

/** Rounds to `sig` significant figures (393,196,721 → 393,000,000). */
export function roundSignificant(x: number, sig = 3): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  return Number(x.toPrecision(sig));
}

/**
 * The amount in the new currency with the same SGD value, to 3 significant
 * figures, and never below the form's minimum.
 */
export function convertAmount(
  amount: number,
  fromSgdPerUnit: number,
  toSgdPerUnit: number,
): number {
  const converted = roundSignificant(
    (amount * fromSgdPerUnit) / toSgdPerUnit,
    3,
  );
  return Math.min(LIMITS.amount.max, Math.max(LIMITS.amount.min, converted));
}

/**
 * A plan's amount in another currency, as the currency picker converts it:
 * both rates as of the plan's start date (the latest rate for a start on or
 * after the newest one), then convertAmount's rounding. `rateDate` is the
 * later of the two rates' dates, for saying which rate was used.
 */
export function convertBetween(
  amount: number,
  from: Series,
  to: Series,
  startDate: string,
): { amount: number; rateDate: string; latest: boolean } {
  const a = rateAsOf(from, startDate);
  const b = rateAsOf(to, startDate);
  const rateDate = a.date > b.date ? a.date : b.date;
  return {
    amount: convertAmount(amount, a.value, b.value),
    rateDate,
    latest: a.date === from.dates.at(-1) && b.date === to.dates.at(-1),
  };
}
