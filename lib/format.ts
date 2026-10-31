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
