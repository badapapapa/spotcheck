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
 * About `target` ticks covering [min, max]. The domain is widened to whole
 * steps, so there are always at least two ticks and one at each end. A flat
 * range gets a small band so there is still something to draw.
 */
export function niceTicks(min: number, max: number, target = 4): Ticks {
  let lo = min;
  let hi = max;
  if (!(hi > lo)) {
    const pad = Math.abs(lo) * 0.01 || 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, target);
  const decimals = decimalsFor(step);
  const first = Math.floor(lo / step + 1e-9);
  const last = Math.ceil(hi / step - 1e-9);
  const ticks: number[] = [];
  for (let k = first; k <= last; k++)
    ticks.push(Number((k * step).toFixed(decimals + 2)));
  return { ticks, step, decimals, domain: [ticks[0]!, ticks.at(-1)!] };
}

/** SGD tick label: decimals from the spacing, and full cents if any are needed. */
export function sgdTickDecimals(t: Ticks): number {
  return t.decimals === 0 ? 0 : Math.max(2, t.decimals);
}
