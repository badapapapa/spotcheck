// Robust statistics for the detector: medians and median absolute
// deviations (MAD), which a few extreme days can't drag around the way they
// drag a mean and standard deviation.

/** The median of `xs` (which it leaves unchanged); NaN when empty. */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** 1.4826 × MAD estimates the standard deviation of normal data. */
export const MAD_TO_SD = 1.4826;

/**
 * For each i, the median and scaled MAD of the `window` values before it
 * (not including i itself), once at least `minCount` are available; NaN
 * before that. Trailing only, so a day is judged by its past alone, as it
 * would be the night it arrives. NaN inputs are skipped.
 */
export function rollingRobust(
  xs: readonly number[],
  window: number,
  minCount: number,
): { center: number[]; scale: number[] } {
  const center: number[] = [];
  const scale: number[] = [];
  const past: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    if (past.length >= minCount) {
      const m = median(past);
      center.push(m);
      scale.push(MAD_TO_SD * median(past.map((x) => Math.abs(x - m))));
    } else {
      center.push(NaN);
      scale.push(NaN);
    }
    const x = xs[i]!;
    if (Number.isFinite(x)) {
      past.push(x);
      if (past.length > window) past.shift();
    }
  }
  return { center, scale };
}

/**
 * (x − center) / scale, with the scale floored at `minScale` so a series
 * that barely moves (a managed currency in a calm month) doesn't turn a
 * tiny move into a huge score.
 */
export function robustZ(
  x: number,
  center: number,
  scale: number,
  minScale: number,
): number {
  if (!Number.isFinite(x) || !Number.isFinite(center)) return NaN;
  return (x - center) / Math.max(scale, minScale);
}
