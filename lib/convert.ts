// Converting the amount when someone switches currency, so the scenario keeps
// the same SGD value (15,000 USD ≈ S$19,200 ≈ 393,000,000 VND).

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
