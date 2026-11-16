// Per-day features of each FX series, for the detector (detect.ts).
// Every value is SGD per 1 unit of the currency, as stored in data/fx.
//
// For day i (from its previous observation):
//   r        the log return, ln(v[i] / v[i-1])
//   z        r as a robust z-score against the trailing year's returns
//            (median and MAD, trailing only: a day is judged by its past)
//   peerZ    the same for r minus the median move of related currencies
//            that day (peers.ts). A move every SGD cross shares (the SGD
//            itself moving, or the euro leg of every ECB cross) cancels; a
//            move in one currency alone doesn't.
//   reverses whether the next day takes the move back almost entirely
//            (leaving at most a fifth of it): the shape of a bad print. Real
//            whipsaws in a crisis take back part of a move, rarely all of
//            it. Unknown (null) for the latest day.
//   staleRun how many days in a row the value hasn't changed, up to i
//   unitPower k when v[i] / v[i-1] is about 10^k (k = ±1, ±2, ±3): a
//            decimal-place or unit error
//   inverted whether v[i] is about 1 / v[i-1] (a rate stored upside down)

import { median, robustZ, rollingRobust } from "./robust.ts";

export type Series = {
  code: string;
  dates: readonly string[];
  /** SGD per 1 unit of the currency. */
  values: readonly number[];
};

export type DayFeatures = {
  date: string;
  r: number;
  z: number;
  peerZ: number;
  reverses: boolean | null;
  staleRun: number;
  unitPower: number | null;
  inverted: boolean;
};

export const FEATURE_SETTINGS = {
  /** Trailing returns the robust z-scores use (about a year of trading). */
  window: 250,
  /** Fewest past returns before a z-score is given (new series start thin). */
  minCount: 15,
  /**
   * Floor for the scale of returns: 0.1% a day. A currency that barely
   * moves (HKD, SAR) mustn't turn a 0.2% move into a ten-sigma event.
   */
  minScale: 0.001,
  /** How close ln(ratio) must be to k·ln 10 to count as a unit error. */
  unitTolerance: 0.1,
  /** How close ln(v[i]) + ln(v[i-1]) must be to 0 to count as inverted. */
  inversionTolerance: 0.05,
  /** An inversion is only told apart from a move when it is this large. */
  minInversionMove: 0.2,
  /** Most of a move that may be left after the next day for a reversal. */
  maxLeftover: 0.2,
} as const;

/** ln(v[i] / v[i-1]) for i ≥ 1; NaN for the first day. */
export function logReturns(values: readonly number[]): number[] {
  return values.map((v, i) => (i === 0 ? NaN : Math.log(v / values[i - 1]!)));
}

/** k when `r` is within `tol` of k·ln 10 for k = ±1, ±2, ±3; else null. */
export function unitPower(r: number, tol: number): number | null {
  for (const k of [1, -1, 2, -2, 3, -3])
    if (Math.abs(r - k * Math.LN10) < tol) return k;
  return null;
}

/** Whether `v` looks like 1 / `prev`, told apart from an ordinary move. */
export function looksInverted(
  v: number,
  prev: number,
  { inversionTolerance, minInversionMove } = FEATURE_SETTINGS,
): boolean {
  return (
    Math.abs(Math.log(v / prev)) >= minInversionMove &&
    Math.abs(Math.log(v) + Math.log(prev)) < inversionTolerance
  );
}

/**
 * Whether `next` takes `r` back, in the other direction, leaving at most
 * `maxLeftover` of it.
 */
export function reversesMove(
  r: number,
  next: number,
  maxLeftover: number,
): boolean {
  return r * next < 0 && Math.abs(r + next) <= maxLeftover * Math.abs(r);
}

/** Days in a row, ending at each i, with an unchanged value. */
export function staleRuns(values: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++)
    out.push(i > 0 && values[i] === values[i - 1] ? out[i - 1]! + 1 : 0);
  return out;
}

/**
 * The median return of `peers` on each of `dates`, skipping peers without
 * an observation that day; NaN when fewer than `minPeers` have one.
 */
export function peerMedians(
  dates: readonly string[],
  peers: readonly Series[],
  minPeers = 3,
): number[] {
  const byDate = peers.map((p) => {
    const r = logReturns(p.values);
    return new Map(p.dates.map((d, i) => [d, r[i]!]));
  });
  return dates.map((d) => {
    const moves = byDate
      .map((m) => m.get(d))
      .filter((x): x is number => x !== undefined && Number.isFinite(x));
    return moves.length >= minPeers ? median(moves) : NaN;
  });
}

/** Features for every day of `series`, given its peers' median moves. */
export function features(
  series: Series,
  peerMove: readonly number[],
  s = FEATURE_SETTINGS,
): DayFeatures[] {
  const r = logReturns(series.values);
  const resid = r.map((x, i) => x - peerMove[i]!);
  const own = rollingRobust(r, s.window, s.minCount);
  const rel = rollingRobust(resid, s.window, s.minCount);
  const stale = staleRuns(series.values);
  return series.dates.map((date, i) => {
    const next = r[i + 1];
    return {
      date,
      r: r[i]!,
      z: robustZ(r[i]!, own.center[i]!, own.scale[i]!, s.minScale),
      peerZ: robustZ(resid[i]!, rel.center[i]!, rel.scale[i]!, s.minScale),
      reverses:
        next === undefined || !Number.isFinite(r[i]!)
          ? null
          : reversesMove(r[i]!, next, s.maxLeftover),
      staleRun: stale[i]!,
      unitPower: Number.isFinite(r[i]!)
        ? unitPower(r[i]!, s.unitTolerance)
        : null,
      inverted:
        i > 0 && looksInverted(series.values[i]!, series.values[i - 1]!, s),
    };
  });
}
