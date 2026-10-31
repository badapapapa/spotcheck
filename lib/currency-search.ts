// Search for the currency picker: match a code ("jpy"), a currency name
// ("yen") or a country that uses it ("Japan"), with the most common exchange
// destinations listed first.

import { CURRENCIES, type CurrencyInfo } from "@/engine/currencies.ts";

/** Listed first, in this order, when nothing has been typed. */
export const POPULAR = ["USD", "GBP", "EUR", "AUD", "CAD", "KRW", "JPY"];

/**
 * Places that use each currency, for search only. Not exhaustive: the
 * countries and territories a student is likely to type.
 */
const COUNTRIES: Record<string, string[]> = {
  USD: ["United States", "USA", "America", "Ecuador", "Puerto Rico"],
  CAD: ["Canada"],
  MXN: ["Mexico"],
  BRL: ["Brazil"],
  ARS: ["Argentina"],
  CLP: ["Chile"],
  COP: ["Colombia"],
  PEN: ["Peru"],
  CNY: ["China"],
  HKD: ["Hong Kong"],
  MOP: ["Macau", "Macao"],
  JPY: ["Japan"],
  KRW: ["South Korea", "Korea"],
  TWD: ["Taiwan"],
  INR: ["India"],
  IDR: ["Indonesia"],
  MYR: ["Malaysia"],
  PHP: ["Philippines"],
  THB: ["Thailand"],
  VND: ["Vietnam"],
  BND: ["Brunei"],
  KZT: ["Kazakhstan"],
  ILS: ["Israel"],
  SAR: ["Saudi Arabia"],
  TRY: ["Turkey", "Türkiye"],
  MAD: ["Morocco"],
  ZAR: ["South Africa"],
  AUD: ["Australia"],
  NZD: ["New Zealand"],
  EUR: [
    "Austria",
    "Belgium",
    "Croatia",
    "Cyprus",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Ireland",
    "Italy",
    "Latvia",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Netherlands",
    "Portugal",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Europe",
  ],
  CZK: ["Czech Republic", "Czechia"],
  DKK: ["Denmark"],
  HUF: ["Hungary"],
  ISK: ["Iceland"],
  NOK: ["Norway"],
  PLN: ["Poland"],
  RUB: ["Russia"],
  SEK: ["Sweden"],
  CHF: ["Switzerland"],
  GBP: ["United Kingdom", "UK", "Britain", "England", "Scotland", "Wales"],
};

/** Countries for a code, for display under the currency name. */
export function countriesFor(code: string): string[] {
  return COUNTRIES[code] ?? [];
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Popular currencies in their fixed order, then the rest A–Z by code. */
export function orderedCurrencies(): {
  popular: CurrencyInfo[];
  rest: CurrencyInfo[];
} {
  const byCode = (a: CurrencyInfo, b: CurrencyInfo) =>
    a.code.localeCompare(b.code);
  return {
    popular: POPULAR.map((c) => CURRENCIES.find((x) => x.code === c)!),
    rest: CURRENCIES.filter((c) => !POPULAR.includes(c.code)).sort(byCode),
  };
}

/**
 * Currencies matching `query`, strongest match first: exact code, then code
 * prefix, then a word in the currency or country name that starts with the
 * query, then any substring. Ties keep the popular-first order.
 */
export function searchCurrencies(query: string): CurrencyInfo[] {
  const q = fold(query);
  const { popular, rest } = orderedCurrencies();
  const all = [...popular, ...rest];
  if (q === "") return all;

  const score = (c: CurrencyInfo): number => {
    const code = c.code.toLowerCase();
    if (code === q) return 0;
    if (code.startsWith(q)) return 1;
    const names = [c.name, ...countriesFor(c.code)].map(fold);
    const words = names.flatMap((n) => n.split(/[\s-]+/));
    if (names.some((n) => n.startsWith(q))) return 2;
    if (words.some((w) => w.startsWith(q))) return 3;
    if (names.some((n) => n.includes(q))) return 4;
    return -1;
  };

  return all
    .map((c, i) => ({ c, i, s: score(c) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.c);
}
