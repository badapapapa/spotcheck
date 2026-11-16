// The footer's line about the nightly data-quality check (lib/quality.ts).

import { formatDate } from "./dates.ts";
import type { QualityFile } from "./quality.ts";

/**
 * "Data checks passed", or "1 recent rate under review: BRL, 26 Oct 2026"
 * (oldest first; "rates" for more than one). No trailing full stop.
 */
export function qualityNote(file: QualityFile): string {
  const n = file.open.length;
  if (n === 0) return "Data checks passed";
  const list = [...file.open]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.currency.localeCompare(b.currency),
    )
    .map((f) => `${f.currency}, ${formatDate(f.date)}`)
    .join("; ");
  return `${n} recent ${n === 1 ? "rate" : "rates"} under review: ${list}`;
}
