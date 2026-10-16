// USD overnight rate: effective federal funds rate (DFF) from FRED.
// With FRED_API_KEY set (the GitHub Actions secret) it uses the official API;
// without one it reads FRED's public CSV download of the same series, so
// local runs work without a key. The key is never logged.

import { z } from "zod";
import { fetchWithRetry } from "./http.ts";
import type { RateRow } from "./schemas.ts";

export const FRED_SOURCE =
  "Board of Governors of the Federal Reserve System, Federal Funds Effective Rate (DFF), retrieved from FRED, Federal Reserve Bank of St. Louis, https://fred.stlouisfed.org/series/DFF";

const ApiSchema = z.object({
  observations: z.array(z.object({ date: z.iso.date(), value: z.string() })),
});

/** FRED gives percent strings; '.' or '' means no observation (not zero). */
export function parseFredValue(value: string): number | null {
  const t = value.trim();
  if (t === "" || t === ".") return null;
  const v = Number(t);
  if (!Number.isFinite(v)) throw new Error(`Bad FRED value '${value}'`);
  return Number((v / 100).toFixed(8));
}

export function parseFredCsv(csv: string): RateRow[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  if (!header?.startsWith("observation_date,")) {
    throw new Error(`FRED CSV: unexpected header '${header}'`);
  }
  const rows: RateRow[] = [];
  for (const line of lines) {
    const [date, value] = line.split(",");
    const v = parseFredValue(value ?? "");
    if (date && v !== null) rows.push([date, v]);
  }
  return rows;
}

export async function fetchFredSeries(
  seriesId: string,
  from: string,
  to: string,
  apiKey: string | undefined,
): Promise<RateRow[]> {
  if (apiKey) {
    const url =
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
      `&api_key=${encodeURIComponent(apiKey)}&file_type=json` +
      `&observation_start=${from}&observation_end=${to}`;
    const res = await fetchWithRetry(url);
    const { observations } = ApiSchema.parse(await res.json());
    return observations.flatMap((o): RateRow[] => {
      const v = parseFredValue(o.value);
      return v === null ? [] : [[o.date, v]];
    });
  }
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${from}&coed=${to}`;
  return parseFredCsv(await (await fetchWithRetry(url)).text());
}
