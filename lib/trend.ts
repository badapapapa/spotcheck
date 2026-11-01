// The long-run move in the rate history, next to the results. Every past
// period is drawn from this one history, so a currency that mostly
// strengthened or weakened over it tilts the results; the note says how the
// rate moved, from the data, and says it symmetrically: neither direction
// nor strategy is favoured.

import type { Series } from "@/engine/types.ts";
import { formatDate } from "./dates.ts";
import { formatRate } from "./format.ts";

export function trendNote(fx: Series, code: string): string | undefined {
  const first = fx.values[0];
  const last = fx.values.at(-1);
  if (first === undefined || last === undefined) return undefined;
  // A peg (BND) doesn't move: there is no trend to describe.
  if (formatRate(first) === formatRate(last)) return undefined;
  return (
    `Across this history SGD per ${code} went from ${formatRate(first)} (${formatDate(fx.dates[0]!)}) ` +
    `to ${formatRate(last)} (${formatDate(fx.dates.at(-1)!)}). ` +
    "In periods when the rate fell, converting later cost less; when it rose, it cost more."
  );
}
