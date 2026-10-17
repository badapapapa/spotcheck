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
};

export const CURRENCIES: readonly CurrencyInfo[] = [
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

export function findCurrency(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

/** Path of a currency's FX file relative to the data root. */
export function fxFileName(code: string): string {
  return `fx/SGD-${code}.json`;
}
