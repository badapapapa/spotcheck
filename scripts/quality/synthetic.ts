// Synthetic errors for the evaluation: copies of a series with one kind of
// bad data put in at a known day, so the detector's hit rate can be counted.

import { features, type DayFeatures, type Series } from "./features.ts";
import { FEATURE_SETTINGS } from "./features.ts";

export type Injection =
  /** One day off by `size` (0.05 = 5%) up or down, right again the next day. */
  | { kind: "spike"; size: number; up: boolean }
  /** One day multiplied by `factor` (10, 100, 0.1, 0.01): a unit error. */
  | { kind: "unit"; factor: number }
  /** One day stored as 1 / its value. */
  | { kind: "inverted" }
  /** `days` days in a row stuck at the previous day's value. */
  | { kind: "stale"; days: number };

/** A copy of `values` with `inj` put in from day `i`. */
export function inject(
  values: readonly number[],
  i: number,
  inj: Injection,
): number[] {
  const v = [...values];
  switch (inj.kind) {
    case "spike":
      v[i] = v[i]! * (inj.up ? 1 + inj.size : 1 - inj.size);
      break;
    case "unit":
      v[i] = v[i]! * inj.factor;
      break;
    case "inverted":
      v[i] = 1 / v[i]!;
      break;
    case "stale":
      for (let k = 0; k < inj.days && i + k < v.length; k++)
        v[i + k] = v[i - 1]!;
      break;
  }
  return v;
}

/**
 * The features of days `from`..`to` of `series` (and of the day after
 * `to`, when there is one, which a reversal and the forest look at),
 * computed from a slice just long enough for each day's trailing window:
 * the same values as for the whole series, in a fraction of the time.
 * Index k of the result is day `from + k`.
 */
export function featuresBetween(
  series: Series,
  peerMove: readonly number[],
  from: number,
  to: number,
  s = FEATURE_SETTINGS,
): DayFeatures[] {
  const start = Math.max(0, from - s.window - 1);
  // Two days past `to`: the day after it, with its own next day known.
  const end = Math.min(series.values.length, to + 3);
  const days = features(
    {
      code: series.code,
      dates: series.dates.slice(start, end),
      values: series.values.slice(start, end),
    },
    peerMove.slice(start, end),
    s,
  );
  return days.slice(from - start, to - start + 2);
}
