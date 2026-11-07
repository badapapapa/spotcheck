// Axis ticks that are tidy (1, 2 or 5 × a power of ten apart) and whose
// labels can never repeat: the number of decimals comes from the spacing.

export type Ticks = {
  ticks: number[];
  step: number;
  /** Decimals needed to tell neighbouring ticks apart. */
  decimals: number;
  domain: [number, number];
};

/** Decimals needed to write `step` exactly (0.25 → 2, 5 → 0, 0.0005 → 4). */
export function decimalsFor(step: number): number {
  for (let d = 0; d <= 12; d++) {
    const scaled = step * 10 ** d;
    const whole = Math.round(scaled);
    // At least one whole unit at this many decimals, and no remainder.
    if (whole >= 1 && Math.abs(scaled - whole) < 1e-6 * scaled) return d;
  }
  return 12;
}

function niceStep(span: number, target: number): number {
  const raw = span / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f >= 5 ? 10 : f >= 2 ? 5 : f >= 1 ? 2 : 1) * pow;
}

/**
 * Spans smaller than this share of the values' size are rounding noise, not
 * a range: the BND peg split into 24 conversions costs S$10,500 in one
 * period and S$10,500.000000000002 in another. Charted as a range, the tick
 * step falls so far below the values that `k++` past 2^53 stops changing k
 * and the tick loop never ends.
 */
const FLAT = 1e-9;

/** True when [min, max] has no width worth drawing (or isn't finite). */
export function isFlat(min: number, max: number): boolean {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return true;
  return !(max - min > FLAT * Math.max(Math.abs(min), Math.abs(max)));
}

/** Never more ticks than this, whatever the inputs. */
const MAX_TICKS = 50;

/**
 * About `target` ticks covering [min, max]. The domain is widened to whole
 * steps, so there are always at least two ticks and one at each end. A flat
 * range (see `isFlat`) gets a small band around its middle so there is still
 * something to draw; a value that isn't finite is read as 0.
 */
export function niceTicks(min: number, max: number, target = 4): Ticks {
  let lo = Number.isFinite(min) ? min : Number.isFinite(max) ? max : 0;
  let hi = Number.isFinite(max) ? max : lo;
  if (hi < lo) [lo, hi] = [hi, lo];
  if (isFlat(lo, hi)) {
    const mid = (lo + hi) / 2;
    const pad = Math.abs(mid) * 0.01 || 1;
    lo = mid - pad;
    hi = mid + pad;
  }
  const step = niceStep(hi - lo, target);
  const decimals = decimalsFor(step);
  const first = Math.floor(lo / step + 1e-9);
  const last = Math.ceil(hi / step - 1e-9);
  const ticks: number[] = [];
  // Counted by index, and capped, so no input can make this loop run on.
  for (let i = 0; i <= Math.min(last - first, MAX_TICKS); i++)
    ticks.push(Number(((first + i) * step).toFixed(decimals + 2)));
  return { ticks, step, decimals, domain: [ticks[0]!, ticks.at(-1)!] };
}

/** SGD tick label: decimals from the spacing, and full cents if any are needed. */
export function sgdTickDecimals(t: Ticks): number {
  return t.decimals === 0 ? 0 : Math.max(2, t.decimals);
}
