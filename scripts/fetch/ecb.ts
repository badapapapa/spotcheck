// FX rates from the European Central Bank's euro foreign exchange reference
// rates, via Frankfurter's single-provider endpoint. No API key.
//
// The ECB publishes every rate against the euro, fixed at the same moment
// (the ~14:10 CET concertation), so an SGD cross built from two of them is a
// consistent snapshot:
//
//   SGD per 1 X = (SGD per EUR) / (X per EUR)
//
// ECB terms: reuse is free with the ECB cited as the source, and any change
// to the data must be stated. The crosses are such a change, which the source
// string and the site's attribution say explicitly.

import { z } from "zod";
import { fetchWithRetry, sleep } from "./http.ts";
import type { FxRow } from "./schemas.ts";

const BASE_URL = "https://api.frankfurter.dev/v2/providers/ecb/rates";

export const ECB_SOURCE =
  "European Central Bank euro foreign exchange reference rates (via https://frankfurter.dev). " +
  "SGD crosses derived by SpotCheck as (SGD per EUR) / (currency per EUR).";

const ResponseSchema = z.array(
  z.object({
    date: z.iso.date(),
    base: z.literal("EUR"),
    quote: z.string(),
    rate: z.number().positive(),
  }),
);

/**
 * One SGD cross from two ECB rates against the euro. Returns the stored row:
 * [date, foreign units per 1 SGD, SGD per 1 foreign unit], both rounded to 8
 * significant figures. For EUR itself, pass xPerEur = 1.
 */
export function ecbCross(
  date: string,
  sgdPerEur: number,
  xPerEur: number,
): FxRow {
  if (!(sgdPerEur > 0 && xPerEur > 0)) {
    throw new Error(`Bad ECB rates on ${date}: SGD ${sgdPerEur}, X ${xPerEur}`);
  }
  return [
    date,
    Number((xPerEur / sgdPerEur).toPrecision(8)),
    Number((sgdPerEur / xPerEur).toPrecision(8)),
  ];
}

/**
 * Fetches ECB reference rates for SGD and `quotes` between `from` and `to`,
 * a year per request, and returns SGD crosses per quote. Days without an SGD
 * rate or without the quote's rate are skipped (no cross can be formed).
 */
export async function fetchEcbCrosses(
  quotes: readonly string[],
  from: string,
  to: string,
): Promise<Map<string, FxRow[]>> {
  const nonEur = quotes.filter((q) => q !== "EUR");
  const byDate = new Map<string, Map<string, number>>();
  const startYear = Number(from.slice(0, 4));
  const endYear = Number(to.slice(0, 4));
  for (let year = startYear; year <= endYear; year++) {
    const chunkFrom = year === startYear ? from : `${year}-01-01`;
    const chunkTo = year === endYear ? to : `${year}-12-31`;
    const url =
      `${BASE_URL}?base=eur&quotes=${["SGD", ...nonEur].join(",").toLowerCase()}` +
      `&from=${chunkFrom}&to=${chunkTo}`;
    if (year > startYear) await sleep(2000); // the public API rate-limits bursts
    const rows = ResponseSchema.parse(await (await fetchWithRetry(url)).json());
    for (const r of rows) {
      const day = byDate.get(r.date) ?? new Map<string, number>();
      day.set(r.quote, r.rate);
      byDate.set(r.date, day);
    }
  }
  const out = new Map<string, FxRow[]>(quotes.map((q) => [q, []]));
  for (const date of [...byDate.keys()].sort()) {
    const day = byDate.get(date)!;
    const sgd = day.get("SGD");
    if (sgd === undefined) continue;
    for (const q of quotes) {
      const x = q === "EUR" ? 1 : day.get(q);
      if (x !== undefined) out.get(q)!.push(ecbCross(date, sgd, x));
    }
  }
  return out;
}
