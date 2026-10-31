// Plain-English description of a replay. It reports what happened in the
// history and never says what anyone should do. Every strategy gets the same
// sentence, in the fixed order, with the same measures, each compared only
// with converting all at once: no sentence compares two other strategies or
// ranks them (DESIGN.md §1, tested in summary.test.ts).

import type { ReplayResult } from "@/engine/replay.ts";
import type { Scenario, StrategyId } from "@/engine/types.ts";
import { formatDate } from "./dates.ts";
import { formatPct, formatPercent, formatSgdAt } from "./format.ts";
import { signedSgd } from "./signed.ts";
import { STRATEGY_STYLE } from "./strategy-style.ts";

/** The strategies described against all at once, in the fixed order. */
const COMPARED: StrategyId[] = ["tranches", "wait", "target"];

export function describeReplay(
  r: ReplayResult,
  scenario: Scenario,
  targetBelowSpot: number,
): string[] {
  const { stats } = r;
  const months = Math.round(r.windowDays / 30.44);
  const lump = stats.lumpSum.summary.median;
  const sgd = (v: number) => formatSgdAt(v, lump);
  const lines: string[] = [];

  lines.push(
    `SpotCheck replayed your ${months}-month plan over ${r.windows.toLocaleString("en-SG")} overlapping windows starting between ${formatDate(r.firstStart)} and ${formatDate(r.lastStart)}. ` +
      `Because neighbouring windows share most of their days, that is closer to ${r.independentWindows} separate histories than ${r.windows.toLocaleString("en-SG")}.`,
  );
  lines.push(
    `All at once: ${sgd(lump)} at the latest mid rate plus your spread, known today, so it has no range.`,
  );
  for (const id of COMPARED) {
    const s = stats[id].summary;
    // The only per-strategy extra is what the strategy is set to (and, for
    // the target, how often it was reached): the measures never change.
    const setting =
      id === "tranches"
        ? ` (${scenario.tranches} conversion${scenario.tranches === 1 ? "" : "s"})`
        : id === "target"
          ? ` (${formatPct(targetBelowSpot)} below the starting rate, reached in ${formatPercent(r.targetHitShare)} of windows)`
          : "";
    lines.push(
      `${STRATEGY_STYLE[id].label}${setting}: median ${signedSgd(s.median - lump, lump)} vs all at once, ` +
        `middle 90% ${sgd(s.p5)}–${sgd(s.p95)}, worst case ${sgd(s.max)}; ` +
        `cheaper than all at once in ${formatPercent(stats[id].beatLumpSum)} of windows.`,
    );
  }
  lines.push(
    "These are past outcomes, not forecasts: future rates can move in ways this history never did.",
  );
  return lines;
}
