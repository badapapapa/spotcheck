// Home-market publishing calendars for the blended currencies: the dates a
// currency's own central bank publishes, from Frankfurter's provider data
// (https://api.frankfurter.dev/v2/providers). They decide which blended rows
// are trading days (trading-days.ts).
//
// Why: Frankfurter's blended rate mixes many central banks, and several of
// them publish on weekends and on other countries' holidays. So the blended
// feed has a row for nearly every calendar day, including days the
// currency's own market was shut. Those rows aren't carried forward: they
// move a little with other banks' cross rates, so an "equal to the previous
// day" test misses most of them, and it drops real ties instead. Checked
// over 2023–2025 (16 Nov 2026): of the weekday repeats in the blended feed,
// 37 fell on days the home bank published (real ties, e.g. ISK 12, SAR 13)
// and 4 on its holidays (ISK 3, MOP 1); ISK alone had 37 holiday weekdays,
// almost all with a small move.
//
// Only banks whose dates are their trading days are used, and only while
// Frankfurter reports no missed publications for them, so a gap in a bank's
// feed can never drop a real trading day. Colombia's BANREP and Russia's CBR
// date each rate by the day it takes effect (2023–2025: 156 and 157 Mondays
// "missing", and BANREP 150 weekend dates), so their dates don't mark
// trading days. Argentina's BCRA has gaps that aren't holidays (no rates for
// 6, 9 and 10 Nov 2026, with publishes_missed 1). PEN, TWD and VND have no
// home bank in Frankfurter. Those six keep every weekday row.

import { z } from "zod";
import { fetchWithRetry, sleep } from "./http.ts";

/** Frankfurter provider keys of the home banks whose dates are trading days. */
export const HOME_PROVIDERS: Readonly<Record<string, string>> = {
  CLP: "bcch", // Banco Central de Chile
  MOP: "amcm", // Autoridade Monetária de Macau
  KZT: "nbk", // National Bank of Kazakhstan
  SAR: "sama", // Saudi Central Bank
  MAD: "bam", // Bank Al-Maghrib
  ISK: "sbi", // Central Bank of Iceland
};

/** The dates a home bank published, and the first and last of them fetched. */
export type Calendar = {
  dates: ReadonlySet<string>;
  first: string;
  last: string;
};

const BASE_URL = "https://api.frankfurter.dev/v2/providers";

const ResponseSchema = z.array(
  z.object({ date: z.iso.date(), quote: z.string(), rate: z.number() }),
);

const ProvidersSchema = z.array(
  z.object({ key: z.string(), publishes_missed: z.number().nullable() }),
);

/**
 * The publishing calendar of each of `codes` that has a home bank, between
 * `from` and `to`, one calendar year per request. Codes without one, or
 * whose bank Frankfurter reports as having missed publications, are left out
 * of the result (and so keep every weekday row).
 */
export async function fetchHomeDates(
  codes: readonly string[],
  from: string,
  to: string,
): Promise<Map<string, Calendar>> {
  const out = new Map<string, Calendar>();
  const status = ProvidersSchema.parse(
    await (await fetchWithRetry(BASE_URL)).json(),
  );
  const reliable = (key: string) =>
    status.find((p) => p.key.toLowerCase() === key)?.publishes_missed === 0;
  let first = true;
  for (const code of codes) {
    const key = HOME_PROVIDERS[code];
    if (!key || !reliable(key)) continue;
    const dates = new Set<string>();
    for (
      let year = Number(from.slice(0, 4));
      year <= Number(to.slice(0, 4));
      year++
    ) {
      const chunkFrom =
        year === Number(from.slice(0, 4)) ? from : `${year}-01-01`;
      const chunkTo = year === Number(to.slice(0, 4)) ? to : `${year}-12-31`;
      // Be polite: the public API rate-limits bursts.
      if (!first) await sleep(2000);
      first = false;
      const url =
        `${BASE_URL}/${key}/rates?base=${code.toLowerCase()}&quotes=usd` +
        `&from=${chunkFrom}&to=${chunkTo}`;
      const rows = ResponseSchema.parse(
        await (await fetchWithRetry(url)).json(),
      );
      for (const r of rows) dates.add(r.date);
    }
    if (dates.size) {
      const sorted = [...dates].sort();
      out.set(code, { dates, first: sorted[0]!, last: sorted.at(-1)! });
    }
  }
  return out;
}
