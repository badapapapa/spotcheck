// Number formatting for the UI. SGD amounts are shown as S$ with no cents
// from S$100 up (the replay isn't precise to the cent).

export function formatSgd(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : 2;
  const s = abs.toLocaleString("en-SG", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${value < 0 ? "−" : ""}S$${s}`;
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
