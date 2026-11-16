// Small, deterministic series for the detector's tests.

import type { Series } from "../features.ts";
import { seeded } from "../rng.ts";

/** ISO weekdays from 2020-01-06 (a Monday), `n` of them. */
export function weekdays(n: number): string[] {
  const out: string[] = [];
  for (let day = Date.UTC(2020, 0, 6); out.length < n; day += 86_400_000) {
    const d = new Date(day);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6)
      out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** A calm random walk: daily moves of about `vol` (0.003 = 0.3%). */
export function walk(
  code: string,
  n: number,
  seed: number,
  start = 1,
  vol = 0.003,
): Series {
  const rand = seeded(seed);
  const values = [start];
  for (let i = 1; i < n; i++) {
    // Box–Muller: a normal draw from two uniform ones.
    const g =
      Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    values.push(values[i - 1]! * Math.exp(vol * g));
  }
  return { code, dates: weekdays(n), values };
}
