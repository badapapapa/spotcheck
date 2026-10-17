// Plain-English description of a replay. It reports what happened in the
// history and never says what anyone should do.

import type { ReplayResult } from "@/engine/replay.ts";
import type { Scenario } from "@/engine/types.ts";
import { formatDate } from "./dates.ts";
import { formatPercent, formatSgd } from "./format.ts";

function compare(diff: number, lower: string, higher: string): string {
  return `${formatSgd(Math.abs(diff))} ${diff < 0 ? lower : higher}`;
}

export function describeReplay(
  r: ReplayResult,
  scenario: Scenario,
  targetBelowSpot: number,
): string[] {
  const { stats } = r;
  const months = Math.round(r.windowDays / 30.44);
  const lump = stats.lumpSum.summary.median;
  const tr = stats.tranches.summary;
  const wait = stats.wait.summary;
  const target = stats.target.summary;
  const lines: string[] = [];

  lines.push(
    `SpotCheck replayed your ${months}-month plan over ${r.windows.toLocaleString("en-SG")} overlapping windows starting between ${formatDate(r.firstStart)} and ${formatDate(r.lastStart)}. ` +
      `Because neighbouring windows share most of their days, that is closer to ${r.independentWindows} separate histories than ${r.windows.toLocaleString("en-SG")}.`,
  );
  lines.push(
    `Converting everything at once costs ${formatSgd(lump)} at today's mid rate plus your spread. That cost is known today, so it has no range.`,
  );
  lines.push(
    `Waiting until the deadline ranged from ${formatSgd(wait.p5)} to ${formatSgd(wait.p95)} in 90% of windows, with a most expensive case of ${formatSgd(wait.max)}. ` +
      `It cost less than converting at once in ${formatPercent(stats.wait.beatLumpSum)} of windows.`,
  );
  if (scenario.tranches > 1) {
    lines.push(
      `In this history, spreading over ${scenario.tranches} conversions had a most expensive case ${compare(tr.max - wait.max, "lower", "higher")} than waiting, ` +
        `and a median within ${formatSgd(Math.abs(tr.median - lump))} of converting at once.`,
    );
  }
  lines.push(
    `A target ${formatPercent(targetBelowSpot, 1)} below the starting rate was reached before the deadline in ${formatPercent(r.targetHitShare)} of windows; ` +
      `when it wasn't, the plan fell back to converting on the deadline. Its median cost was ${compare(target.median - lump, "below", "above")} converting at once.`,
  );
  lines.push(
    "These are past outcomes, not forecasts: future rates can move in ways this history never did.",
  );
  return lines;
}
