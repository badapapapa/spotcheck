// Number formatting for the UI.
//
// SGD amounts: S$100 and above in whole dollars (the replay isn't precise to
// the cent); under S$100 with cents, so small amounts (15,000 VND is about
// S$0.74) stay readable. Axis ticks pass `decimals` chosen from the tick
// spacing instead (see lib/ticks.ts).

export function formatSgd(
  value: number,
  { decimals }: { decimals?: number } = {},
): string {
  const digits = decimals ?? (Math.abs(Number(value.toFixed(2))) < 100 ? 2 : 0);
  // Round first so -0.004 shows as "S$0.00", not "−S$0.00".
  const rounded = Number(value.toFixed(digits));
  const s = Math.abs(rounded).toLocaleString("en-SG", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${rounded < 0 ? "−" : ""}S$${s}`;
}

const COMPACT = [
  { unit: 1e12, suffix: "T" },
  { unit: 1e9, suffix: "B" },
  { unit: 1e6, suffix: "M" },
  { unit: 1e3, suffix: "K" },
] as const;

/**
 * Axis ticks too long to sit side by side (a huge amount on a narrow
 * screen), shortened: S$1.0T, S$1.5B, S$20K. One unit for the whole axis,
 * from its largest tick, and the decimals the spacing (`step`) needs, so
 * neighbouring ticks never read the same. The full values stay in the
 * accessible text.
 */
export function formatSgdCompactTicks(ticks: number[], step: number): string[] {
  const top = Math.max(...ticks.map(Math.abs));
  const c = COMPACT.find((u) => top >= u.unit);
  if (!c) return ticks.map((t) => formatSgd(t, { decimals: 0 }));
  // 0.5T apart needs one decimal (1.0T, 1.5T); 2K apart needs none.
  const inUnit = step / c.unit;
  let decimals = 0;
  while (
    decimals < 3 &&
    Math.abs(Math.round(inUnit * 10 ** decimals) - inUnit * 10 ** decimals) >
      1e-6
  )
    decimals++;
  return ticks.map((t) => {
    const v = Number((t / c.unit).toFixed(decimals));
    const s = Math.abs(v).toLocaleString("en-SG", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${v < 0 ? "−" : ""}S$${s}${c.suffix}`;
  });
}

/**
 * Decimal places for every S$ figure in one scenario: whole dollars when the
 * scenario costs S$100 or more, cents when it costs less (15,000 VND is about
 * S$0.74). One rule per scenario, so a difference of S$85 never shows as
 * S$84.95 next to whole-dollar costs.
 */
export function sgdDigits(scale: number): 0 | 2 {
  return Math.abs(scale) >= 100 ? 0 : 2;
}

/** formatSgd with the scenario's decimal places (see sgdDigits). */
export function formatSgdAt(value: number, scale: number): string {
  return formatSgd(value, { decimals: sgdDigits(scale) });
}

/** A fraction as a percentage without trailing zeros: 0.02 → "2%", 0.025 → "2.5%". */
export function formatPct(fraction: number): string {
  return `${Number((fraction * 100).toFixed(2))}%`;
}

export function formatAmount(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-SG", { maximumFractionDigits: 2 })}`;
}

/** FX rate in SGD per unit with enough significant figures for small units. */
export function formatRate(rate: number): string {
  return rate.toPrecision(rate >= 0.1 ? 5 : 4);
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** U+2212, the minus sign used for every negative figure. */
export const MINUS = "−";

/**
 * Per-unit option premium in SGD. Deep out-of-the-money calls are worth
 * fractions of a millionth; "<0.000001" reads better than "2.250e-10".
 */
export function formatPremiumPerUnit(premium: number): string {
  return premium > 0 && premium < 1e-6 ? "<0.000001" : formatRate(premium);
}

/** Forward points: "−245.3 pips (−0.02453)", with U+2212 in both places. */
export function formatPips(points: number): string {
  const sign = points < 0 ? MINUS : "+";
  const pips = Math.abs(points * 10_000).toFixed(1);
  return `${points < 0 ? MINUS : ""}${pips} pips (${sign}${formatRate(Math.abs(points))})`;
}

/**
 * A rate for a currency pegged 1:1 to SGD: four decimals, like the peg
 * itself ("1.0000", "0.9800"), never "0.98000".
 */
export function formatPegRate(rate: number): string {
  return rate.toFixed(4);
}
