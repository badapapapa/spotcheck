// The data-quality detector: flags days in the FX series that look like bad
// data rather than real moves. It reads the series and never changes them.
//
// Severe (almost never a real move):
//   unit      the value is about 10, 100 or 1000 times (or a fraction of)
//             the day before: a decimal-place or unit error
//   inverted  the value is about 1 / the day before: stored upside down
// Soft (worth a look; real markets do this occasionally):
//   spike     a large move, unlike its region's peers, taken back the next
//             day: the shape of a bad print. Known the day after it arrives.
//   move      a very large move unlike its peers (a devaluation, or an
//             error that hasn't reversed yet). Known the day it arrives.
//   stale     the value hasn't changed for several days in a row
//   outlier   an isolation forest finds the day's features unusual, and no
//             rule above already flags it
// One flag per series and day: the first kind above that applies. The day
// a flagged spike is taken back gets no flag of its own.

import {
  features,
  peerMedians,
  type DayFeatures,
  type Series,
} from "./features.ts";
import { fitForest, score, type Forest } from "./iforest.ts";
import { peersOf } from "./peers.ts";

export type FlagKind =
  "unit" | "inverted" | "spike" | "move" | "stale" | "outlier";
export type Flag = {
  code: string;
  date: string;
  kind: FlagKind;
  severity: "severe" | "soft";
  /** The day's move as a fraction (−0.095 = −9.5%). */
  move: number;
  /** Its z-scores, alone and against peers; null before a series has enough history. */
  z: number | null;
  peerZ: number | null;
  /** The isolation forest's score, for an outlier flag; otherwise null. */
  score: number | null;
  /** The reason in words, for logs and reports. */
  why: string;
};

export type Thresholds = {
  /** |z| and |peer z| for a move that reverses the next day. */
  spikeZ: number;
  spikePeerZ: number;
  /** |z| and |peer z| for a move, reversing or not. */
  moveZ: number;
  movePeerZ: number;
  /** Unchanged days in a row. */
  staleDays: number;
  /** Isolation-forest score, in (0, 1]. */
  outlierScore: number;
};

/**
 * The thresholds the nightly check uses, chosen in docs/quality/evaluation.md:
 * under half a soft flag per currency per 5 years over the whole history,
 * with the listed upstream error caught (the night after it arrives) and
 * every synthetic unit error caught on arrival.
 */
export const PROPOSED: Thresholds = {
  spikeZ: 6,
  spikePeerZ: 6,
  moveZ: 20,
  movePeerZ: 20,
  staleDays: 2,
  outlierScore: 0.78,
};

/** Pegged series (BND) are constant by design: nothing to check. */
export const SKIP = new Set(["BND"]);

const pct = (r: number) =>
  `${r >= 0 ? "+" : "−"}${(Math.abs(Math.expm1(r)) * 100).toFixed(1)}%`;
const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "n/a");

/** The forest's view of a day: how far out it is, alone and against peers. */
export function forestRow(f: DayFeatures, next?: DayFeatures): number[] {
  const back =
    f.reverses && next && Number.isFinite(next.z)
      ? Math.min(Math.abs(f.z), Math.abs(next.z))
      : 0;
  return [
    Math.log1p(Math.abs(f.z)),
    Math.log1p(Math.abs(f.peerZ)),
    Math.log1p(back),
  ];
}

/** Each series' peer median move on each of its days (peers.ts). */
export function peerMoves(series: readonly Series[]): Map<string, number[]> {
  const byCode = new Map(series.map((s) => [s.code, s]));
  const out = new Map<string, number[]>();
  for (const s of series) {
    if (SKIP.has(s.code)) continue;
    const peers = peersOf(s.code)
      .map((c) => byCode.get(c))
      .filter((p): p is Series => p !== undefined);
    out.set(s.code, peerMedians(s.dates, peers));
  }
  return out;
}

/** Features for every series, each against its own region's peers. */
export function allFeatures(
  series: readonly Series[],
  moves = peerMoves(series),
): Map<string, DayFeatures[]> {
  const out = new Map<string, DayFeatures[]>();
  for (const s of series)
    if (!SKIP.has(s.code)) out.set(s.code, features(s, moves.get(s.code)!));
  return out;
}

/** A seeded forest over every day with both z-scores. */
export function fitOn(
  all: Map<string, DayFeatures[]>,
  seed = 20261116,
): Forest {
  const rows: number[][] = [];
  for (const days of all.values())
    days.forEach((f, i) => {
      if (Number.isFinite(f.z) && Number.isFinite(f.peerZ))
        rows.push(forestRow(f, days[i + 1]));
    });
  return fitForest(rows, { seed });
}

/** The flag for one day, if any (see the list at the top). */
export function flagDay(
  code: string,
  days: readonly DayFeatures[],
  i: number,
  t: Thresholds,
  forest?: Forest,
): Flag | null {
  const f = days[i]!;
  if (i === 0) return null;
  const finite = (x: number) => (Number.isFinite(x) ? x : null);
  const at = (
    kind: FlagKind,
    severity: Flag["severity"],
    why: string,
    score: number | null = null,
  ): Flag => ({
    code,
    date: f.date,
    kind,
    severity,
    move: Math.expm1(f.r),
    z: finite(f.z),
    peerZ: finite(f.peerZ),
    score,
    why,
  });
  if (f.unitPower !== null)
    return at(
      "unit",
      "severe",
      `${pct(f.r)}: about ${f.unitPower > 0 ? "×" : "÷"}${10 ** Math.abs(f.unitPower)} the previous day`,
    );
  if (f.inverted)
    return at(
      "inverted",
      "severe",
      `${pct(f.r)}: about 1 / the previous day's value`,
    );
  const big = (z: number, p: number) =>
    Math.abs(f.z) >= z && Math.abs(f.peerZ) >= p;
  // The day a spike is taken back is part of that spike, already flagged:
  // the return to the old level isn't news of its own.
  const prev = days[i - 1]!;
  if (
    prev.reverses &&
    Math.abs(prev.z) >= t.spikeZ &&
    Math.abs(prev.peerZ) >= t.spikePeerZ
  )
    return null;
  if (f.reverses && big(t.spikeZ, t.spikePeerZ))
    return at(
      "spike",
      "soft",
      `${pct(f.r)} (z ${fmt(f.z)}, ${fmt(f.peerZ)} against peers), taken back the next day`,
    );
  if (big(t.moveZ, t.movePeerZ))
    return at(
      "move",
      "soft",
      `${pct(f.r)} (z ${fmt(f.z)}, ${fmt(f.peerZ)} against peers)${f.reverses === false ? ", not taken back" : ""}`,
    );
  if (f.staleRun === t.staleDays)
    return at(
      "stale",
      "soft",
      `unchanged for ${t.staleDays + 1} days in a row`,
    );
  if (forest && Number.isFinite(f.z) && Number.isFinite(f.peerZ)) {
    const s = score(forest, forestRow(f, days[i + 1]));
    if (s >= t.outlierScore)
      return at(
        "outlier",
        "soft",
        `${pct(f.r)}: unusual features (forest score ${s.toFixed(2)}; z ${fmt(f.z)}, ${fmt(f.peerZ)} against peers)`,
        s,
      );
  }
  return null;
}

/** Every flag in every series. */
export function detect(
  all: Map<string, DayFeatures[]>,
  t: Thresholds,
  forest?: Forest,
): Flag[] {
  const flags: Flag[] = [];
  for (const [code, days] of all)
    for (let i = 1; i < days.length; i++) {
      const flag = flagDay(code, days, i, t, forest);
      if (flag) flags.push(flag);
    }
  return flags;
}
