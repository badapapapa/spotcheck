// FX rates from Frankfurter (https://frankfurter.dev), blended central-bank
// mid rates. No API key.

import { z } from "zod";
import { fetchWithRetry, sleep } from "./http.ts";
import type { FxRow } from "./schemas.ts";

const BASE_URL = "https://api.frankfurter.dev/v2/rates";

export const FRANKFURTER_SOURCE =
  "Frankfurter (blended central-bank mid rates), https://frankfurter.dev";

const ResponseSchema = z.array(
  z.object({
    date: z.iso.date(),
    base: z.literal("SGD"),
    quote: z.string(),
    rate: z.number().positive(),
  }),
);

/**
 * Frankfurter quotes foreign units per 1 SGD (e.g. 0.78015 USD per SGD).
 * SpotCheck always works in SGD per 1 foreign unit, so this is the one place
 * the quote is flipped. Rounded to 8 significant figures, far beyond the
 * precision of the source.
 */
export function invertFrankfurterRate(foreignPerSgd: number): number {
  if (!(foreignPerSgd > 0) || !Number.isFinite(foreignPerSgd)) {
    throw new Error(`Cannot invert non-positive rate ${foreignPerSgd}`);
  }
  return Number((1 / foreignPerSgd).toPrecision(8));
}

/**
 * Fetches daily rates for `quotes` between `from` and `to` (inclusive),
 * one calendar year per request, and returns rows per quote, sorted by date.
 */
export async function fetchFx(
  quotes: readonly string[],
  from: string,
  to: string,
): Promise<Map<string, FxRow[]>> {
  const byQuote = new Map<string, Map<string, number>>(
    quotes.map((q) => [q, new Map()]),
  );
  const startYear = Number(from.slice(0, 4));
  const endYear = Number(to.slice(0, 4));
  for (let year = startYear; year <= endYear; year++) {
    const chunkFrom = year === startYear ? from : `${year}-01-01`;
    const chunkTo = year === endYear ? to : `${year}-12-31`;
    const url =
      `${BASE_URL}?base=sgd&quotes=${quotes.join(",").toLowerCase()}` +
      `&from=${chunkFrom}&to=${chunkTo}`;
    // Be polite: the public API rate-limits bursts.
    if (year > startYear) await sleep(2000);
    const res = await fetchWithRetry(url);
    const rows = ResponseSchema.parse(await res.json());
    for (const row of rows) {
      // Keep the date exactly as given; a later duplicate overwrites.
      byQuote.get(row.quote)?.set(row.date, row.rate);
    }
  }
  const out = new Map<string, FxRow[]>();
  for (const [quote, rates] of byQuote) {
    const rows = [...rates.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, raw]): FxRow => [date, raw, invertFrankfurterRate(raw)]);
    out.set(quote, rows);
  }
  return out;
}
