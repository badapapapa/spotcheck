// Plain-English description of a replay. It reports what happened in the
// history and never says what anyone should do. Every strategy gets the same
// sentence, in the fixed order, with the same measures, each compared only
// with converting all at once: no sentence compares two other strategies or
// ranks them (DESIGN.md §1, tested in summary.test.ts).

import type { ReplayResult } from "@/engine/replay.ts";
import type { Scenario, StrategyId } from "@/engine/types.ts";
import { formatDate, planLength } from "./dates.ts";
import { formatPct, formatPercent, formatSgdAt } from "./format.ts";
import { signedDiff } from "./signed.ts";
import { lumpSumSentence, type StartContext } from "./start-context.ts";
import { STRATEGY_STYLE } from "./strategy-style.ts";

/** The strategies described against all at once, in the fixed order. */
const COMPARED: StrategyId[] = ["tranches", "wait", "target"];

export function describeReplay(
  r: ReplayResult,
  scenario: Scenario,
  targetBelowSpot: number,
  // Which rate the plan starts from (see start-context.ts); by default the
  // latest, as for a plan starting today.
  start: StartContext = { kind: "latest", rateDate: r.referenceDate },
): string[] {
  const { stats } = r;
  const lump = stats.lumpSum.summary.median;
  const sgd = (v: number) => formatSgdAt(v, lump);
  const count = (n: number) => n.toLocaleString("en-SG");
  const lines: string[] = [];

  lines.push(
    `SpotCheck replayed your ${planLength(r.windowDays)} plan over ${count(r.windows)} overlapping windows starting between ${formatDate(r.firstStart)} and ${formatDate(r.lastStart)}. ` +
      `Because neighbouring windows share most of their days, that is closer to ${count(r.independentWindows)} separate histories than ${count(r.windows)}.`,
  );
  lines.push(lumpSumSentence(start, sgd(lump)));
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
    // A range that rounds to one figure (the BND peg) reads "(fixed)", as
    // in the table, not "S$15,075–S$15,075".
    const middle =
      sgd(s.p5) === sgd(s.p95)
        ? `${sgd(s.p5)} (fixed)`
        : `${sgd(s.p5)}–${sgd(s.p95)}`;
    lines.push(
      `${STRATEGY_STYLE[id].label}${setting}: median ${signedDiff(s.median, lump, lump)} vs all at once, ` +
        `middle 90% ${middle}, worst case ${sgd(s.max)}; ` +
        `cheaper than all at once in ${formatPercent(stats[id].beatLumpSum)} of windows.`,
    );
  }
  lines.push(
    "These are past outcomes, not forecasts: future rates can move in ways this history never did.",
  );
  return lines;
}
