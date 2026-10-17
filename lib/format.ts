// Number formatting for the UI. SGD amounts are whole dollars everywhere
// (the replay isn't precise to the cent). Pass { cents: true } only for
// genuinely small per-unit or per-day figures.

export function formatSgd(value: number, { cents = false } = {}): string {
  const digits = cents ? 2 : 0;
  // Round first so -0.4 shows as "S$0", not "−S$0".
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
