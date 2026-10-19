// The 40 currencies used by NUS, NTU and SMU exchange destinations.
// This file has no imports so the data scripts can load it directly with Node.

export type CurrencyInfo = {
  code: string;
  name: string;
  flag: string;
  /**
   * FRED series id for this currency's overnight interest rate, if we have
   * one. Forward and option pricing need it, so only these currencies get the
   * advanced tab.
   */
  rateSeries?: string;
  /** Pegged 1:1 to SGD, so every strategy costs the same. */
  peggedToSgd?: boolean;
  /**
   * Where this currency's whole FX history comes from (one source per
   * currency, never spliced, so there are no artificial jumps):
   * - "ecb": ECB euro reference rates, SGD cross derived via EUR. Used when
   *   the ECB has published the currency continuously from 13 Jan 2000 or
   *   earlier through today (most from 4 Jan 1999; BRL, CNY, ILS and INR from
   *   13 Jan 2000, so their history starts there).
   * - "blended": Frankfurter's blended rates, for everything else. Blending
   *   providers that fix at different times smooths daily moves, so daily
   *   volatility from these is understated.
   * - "peg": a constant 1:1 series (BND).
   */
  fxSource: FxSource;
};

export type FxSource = "ecb" | "blended" | "peg";

/**
 * Currencies the ECB has published continuously from 13 Jan 2000 or earlier
 * through today.
 */
const ECB_CONTINUOUS = new Set([
  "BRL",
  "CNY",
  "ILS",
  "INR",
  "USD",
  "CAD",
  "MXN",
  "HKD",
  "JPY",
  "KRW",
  "IDR",
  "MYR",
  "PHP",
  "THB",
  "TRY",
  "ZAR",
  "AUD",
  "NZD",
  "EUR",
  "CZK",
  "DKK",
  "HUF",
  "NOK",
  "PLN",
  "SEK",
  "CHF",
  "GBP",
]);

const LIST: readonly Omit<CurrencyInfo, "fxSource">[] = [
  { code: "USD", name: "US dollar", flag: "🇺🇸", rateSeries: "USD-DFF" },
  { code: "CAD", name: "Canadian dollar", flag: "🇨🇦" },
  { code: "MXN", name: "Mexican peso", flag: "🇲🇽" },
  { code: "BRL", name: "Brazilian real", flag: "🇧🇷" },
  { code: "ARS", name: "Argentine peso", flag: "🇦🇷" },
  { code: "CLP", name: "Chilean peso", flag: "🇨🇱" },
  { code: "COP", name: "Colombian peso", flag: "🇨🇴" },
  { code: "PEN", name: "Peruvian sol", flag: "🇵🇪" },
  { code: "CNY", name: "Chinese yuan", flag: "🇨🇳" },
  { code: "HKD", name: "Hong Kong dollar", flag: "🇭🇰" },
  { code: "MOP", name: "Macanese pataca", flag: "🇲🇴" },
  { code: "JPY", name: "Japanese yen", flag: "🇯🇵" },
  { code: "KRW", name: "South Korean won", flag: "🇰🇷" },
  { code: "TWD", name: "New Taiwan dollar", flag: "🇹🇼" },
  { code: "INR", name: "Indian rupee", flag: "🇮🇳" },
  { code: "IDR", name: "Indonesian rupiah", flag: "🇮🇩" },
  { code: "MYR", name: "Malaysian ringgit", flag: "🇲🇾" },
  { code: "PHP", name: "Philippine peso", flag: "🇵🇭" },
  { code: "THB", name: "Thai baht", flag: "🇹🇭" },
  { code: "VND", name: "Vietnamese dong", flag: "🇻🇳" },
  { code: "BND", name: "Brunei dollar", flag: "🇧🇳", peggedToSgd: true },
  { code: "KZT", name: "Kazakhstani tenge", flag: "🇰🇿" },
  { code: "ILS", name: "Israeli shekel", flag: "🇮🇱" },
  { code: "SAR", name: "Saudi riyal", flag: "🇸🇦" },
  { code: "TRY", name: "Turkish lira", flag: "🇹🇷" },
  { code: "MAD", name: "Moroccan dirham", flag: "🇲🇦" },
  { code: "ZAR", name: "South African rand", flag: "🇿🇦" },
  { code: "AUD", name: "Australian dollar", flag: "🇦🇺" },
  { code: "NZD", name: "New Zealand dollar", flag: "🇳🇿" },
  { code: "EUR", name: "Euro", flag: "🇪🇺" },
  { code: "CZK", name: "Czech koruna", flag: "🇨🇿" },
  { code: "DKK", name: "Danish krone", flag: "🇩🇰" },
  { code: "HUF", name: "Hungarian forint", flag: "🇭🇺" },
  { code: "ISK", name: "Icelandic krona", flag: "🇮🇸" },
  { code: "NOK", name: "Norwegian krone", flag: "🇳🇴" },
  { code: "PLN", name: "Polish zloty", flag: "🇵🇱" },
  { code: "RUB", name: "Russian ruble", flag: "🇷🇺" },
  { code: "SEK", name: "Swedish krona", flag: "🇸🇪" },
  { code: "CHF", name: "Swiss franc", flag: "🇨🇭" },
  { code: "GBP", name: "British pound", flag: "🇬🇧" },
];

export const CURRENCIES: readonly CurrencyInfo[] = LIST.map((c) => ({
  ...c,
  fxSource: c.peggedToSgd
    ? "peg"
    : ECB_CONTINUOUS.has(c.code)
      ? "ecb"
      : "blended",
}));

/** What the UI shows under results for a currency's data source. */
export function fxSourceLabel(
  currency: Pick<CurrencyInfo, "code" | "fxSource">,
): string {
  switch (currency.fxSource) {
    case "ecb":
      // The ECB publishes SGD per EUR itself; every other rate is a cross.
      return currency.code === "EUR"
        ? "Source: ECB euro reference rate."
        : "Source: ECB euro reference rates (SGD cross derived via EUR).";
    case "blended":
      return "Source: Frankfurter blended rates; daily volatility may be understated.";
    case "peg":
      return "Source: fixed 1:1 peg to the Singapore dollar.";
  }
}

export function findCurrency(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

/** Path of a currency's FX file relative to the data root. */
export function fxFileName(code: string): string {
  return `fx/SGD-${code}.json`;
}
