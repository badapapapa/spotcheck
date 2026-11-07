// A plan in one line, every setting the results depend on, for the "not
// current" notice: "USD 15,000 by 1 Aug 2027, from 17 Oct 2026,
// 6 conversions, 0.5% fee, 2% target".

import { formatDate } from "./dates.ts";
import type { PlannerState } from "./url-state.ts";

/** 0.005 → "0.5" (no trailing zeros, no float noise). */
const pct = (fraction: number) => String(Number((fraction * 100).toFixed(4)));

export function planInWords(state: PlannerState): string {
  const s = state.scenario;
  const conversions = `${s.tranches} conversion${s.tranches === 1 ? "" : "s"}`;
  return (
    `${s.currency} ${s.amount.toLocaleString("en-SG")} by ${formatDate(s.deadline)}, ` +
    `from ${formatDate(s.startDate)}, ${conversions}, ` +
    `${pct(s.spread)}% fee, ${pct(state.targetBelowSpot)}% target`
  );
}
