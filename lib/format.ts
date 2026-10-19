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
