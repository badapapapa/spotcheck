// Entry point for `npm run fetch-data` and the daily GitHub Actions job.
//
// For each series: read the committed file, re-fetch from a little before its
// last date (sources sometimes revise recent days), merge, then validate
// everything. Files are written only if every check passes, so a bad fetch
// leaves yesterday's data in place. Pass --full to re-download all history.

import { CURRENCIES, fxFileName } from "../../engine/currencies.ts";
import { FRANKFURTER_SOURCE, fetchFx } from "./frankfurter.ts";
import { FRED_SOURCE, fetchFredSeries } from "./fred.ts";
import { readJson, stringifyDataFile, writeIfChanged } from "./io.ts";
import { tradingObservations } from "./trading-days.ts";
import { MAS_SOURCE, fetchSora } from "./mas.ts";
import {
  FxFileSchema,
  RateFileSchema,
  SoraFileSchema,
  type FxFile,
  type MetaFile,
  type RateFile,
  type SoraFile,
} from "./schemas.ts";
import { checkAll, type DataFiles } from "./validate.ts";

const FX_START = "1999-01-04";
const SORA_START = "2005-07-01"; // first published SORA
const DFF_START = "2005-01-01";
const REFETCH_DAYS = 14;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Today's date in Singapore, where the data is published. */
function todaySgt(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
}

function fetchStart(
  rows: readonly (readonly [string, ...unknown[]])[] | undefined,
  earliest: string,
  full: boolean,
): string {
  const last = rows?.at(-1)?.[0];
  if (full || !last) return earliest;
  const start = addDays(last, -REFETCH_DAYS);
  return start < earliest ? earliest : start;
}

/** Keeps old rows before `from`, replaces everything from `from` on. */
function merge<R extends readonly [string, ...unknown[]]>(
  old: readonly R[] | undefined,
  fresh: readonly R[],
  from: string,
): R[] {
  return [...(old ?? []).filter((r) => r[0] < from), ...fresh];
}

async function main(): Promise<void> {
  const full = process.argv.includes("--full");
  const today = todaySgt();
  const files: DataFiles = { fx: new Map(), sora: undefined, rates: new Map() };

  // FX: one batch of requests for all currencies except the pegged BND.
  const fxCodes = CURRENCIES.filter((c) => !c.peggedToSgd).map((c) => c.code);
  const oldFx = new Map(
    fxCodes.map((code) => [code, readJson(fxFileName(code), FxFileSchema)]),
  );
  const fxFrom = fxCodes
    .map((code) => fetchStart(oldFx.get(code)?.rows, FX_START, full))
    .sort()[0]!;
  console.log(`FX: fetching ${fxCodes.length} currencies from ${fxFrom}`);
  const freshFx = await fetchFx(fxCodes, fxFrom, today);
  for (const code of fxCodes) {
    const file: FxFile = {
      kind: "fx",
      quote: code,
      unit: `SGD per 1 ${code}`,
      source: FRANKFURTER_SOURCE,
      // Applied to the merged history, so older rows are cleaned too.
      rows: tradingObservations(
        merge(oldFx.get(code)?.rows, freshFx.get(code) ?? [], fxFrom),
      ),
    };
    files.fx.set(code, file);
  }

  // BND is pegged 1:1 to SGD by the currency board, so it is a constant
  // series on the USD dates rather than noisy fetched data.
  const usd = files.fx.get("USD")!;
  for (const c of CURRENCIES.filter((c) => c.peggedToSgd)) {
    files.fx.set(c.code, {
      kind: "fx",
      quote: c.code,
      unit: `SGD per 1 ${c.code}`,
      source:
        "Constant: pegged 1:1 to SGD under the Currency Interchangeability Agreement",
      note: "Pegged at par, so every conversion strategy costs the same.",
      rows: usd.rows.map(([date]) => [date, 1, 1]),
    });
  }

  // SORA from MAS.
  const oldSora = readJson("rates/SORA.json", SoraFileSchema);
  const soraFrom = fetchStart(oldSora?.rows, SORA_START, full);
  console.log(`SORA: fetching from ${soraFrom}`);
  const sora: SoraFile = {
    kind: "sora",
    unit: "decimal, annualised (ACT/365)",
    source: MAS_SOURCE,
    rows: merge(oldSora?.rows, await fetchSora(soraFrom, today), soraFrom),
  };
  files.sora = sora;

  // USD effective fed funds rate from FRED.
  const oldDff = readJson("rates/USD-DFF.json", RateFileSchema);
  const dffFrom = fetchStart(oldDff?.rows, DFF_START, full);
  console.log(
    `USD-DFF: fetching from ${dffFrom} (${process.env.FRED_API_KEY ? "FRED API" : "public CSV, no key set"})`,
  );
  const dff: RateFile = {
    kind: "rate",
    series: "USD-DFF",
    unit: "decimal, annualised (ACT/360 as published)",
    source: FRED_SOURCE,
    rows: merge(
      oldDff?.rows,
      await fetchFredSeries("DFF", dffFrom, today, process.env.FRED_API_KEY),
      dffFrom,
    ),
  };
  files.rates.set("USD-DFF", dff);

  const { errors, warnings } = checkAll(files);
  if (warnings.length) {
    console.log(`${warnings.length} warning(s), e.g.:`);
    for (const w of warnings.slice(-10)) console.log(`  warn: ${w}`);
  }
  if (errors.length) {
    for (const e of errors) console.error(`  ERROR: ${e}`);
    console.error(
      `Validation failed (${errors.length} errors). Nothing written.`,
    );
    process.exit(1);
  }

  const meta: MetaFile = { series: {}, attribution: ATTRIBUTION };
  let changed = 0;
  const write = (
    path: string,
    file: { rows: readonly (readonly [string, ...unknown[]])[] },
    key: string,
  ) => {
    if (writeIfChanged(path, stringifyDataFile(file))) changed++;
    meta.series[key] = {
      first: file.rows[0]![0],
      last: file.rows.at(-1)![0],
      count: file.rows.length,
    };
  };
  for (const [code, file] of files.fx)
    write(fxFileName(code), file, `SGD-${code}`);
  write("rates/SORA.json", sora, "SORA");
  write("rates/USD-DFF.json", dff, "USD-DFF");
  if (writeIfChanged("meta.json", JSON.stringify(meta, null, 2) + "\n"))
    changed++;
  console.log(`Done. ${changed} file(s) changed.`);
}

const ATTRIBUTION: MetaFile["attribution"] = [
  { name: "Frankfurter", url: "https://frankfurter.dev/" },
  {
    name: "Monetary Authority of Singapore",
    url: "https://eservices.mas.gov.sg/Statistics/dir/DomesticInterestRates.aspx",
  },
  {
    name: "FRED, Federal Reserve Bank of St. Louis",
    url: "https://fred.stlouisfed.org/series/DFF",
  },
];

await main();
