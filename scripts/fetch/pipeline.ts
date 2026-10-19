// The data pipeline, separated from its entry point (run.ts) so tests can run
// it with fake sources and a fake file system.
//
// For each series: read the committed file, re-fetch from a little before its
// last date (sources sometimes revise recent days), merge, then validate
// everything. Files are written only if every fetch and every check succeeds,
// so a bad day leaves yesterday's data in place.

import { CURRENCIES, fxFileName } from "../../engine/currencies.ts";
import { type fetchEcbCrosses } from "./ecb.ts";
import { type fetchFx } from "./frankfurter.ts";
import { FX_SOURCES } from "./sources.ts";
import { FRED_SOURCE, type fetchFredSeries } from "./fred.ts";
import { stringifyDataFile, type readJson, type writeIfChanged } from "./io.ts";
import { MAS_SOURCE, type fetchSora } from "./mas.ts";
import {
  FxFileSchema,
  RateFileSchema,
  SoraFileSchema,
  type FxFile,
  type MetaFile,
  type RateFile,
  type SoraFile,
} from "./schemas.ts";
import { tradingObservations } from "./trading-days.ts";
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

/** Everything the pipeline touches outside itself, so tests can swap it. */
export type PipelineDeps = {
  today: string;
  full: boolean;
  fredApiKey?: string;
  fetchFx: typeof fetchFx;
  fetchEcbCrosses: typeof fetchEcbCrosses;
  fetchSora: typeof fetchSora;
  fetchFredSeries: typeof fetchFredSeries;
  readJson: typeof readJson;
  writeIfChanged: typeof writeIfChanged;
  log: (message: string) => void;
};

export class ValidationError extends Error {}

/**
 * Fetches, merges and validates every series, then writes. Any fetch error
 * or failed check throws before the first write, so nothing is half-updated.
 */
export async function runPipeline(
  deps: PipelineDeps,
): Promise<{ changed: number }> {
  const { today, full, readJson, writeIfChanged, log } = deps;
  const fetchFx = deps.fetchFx;
  const fetchSora = deps.fetchSora;
  const fetchFredSeries = deps.fetchFredSeries;
  const oldFx = new Map<string, FxFile | undefined>();
  const files: DataFiles = { fx: new Map(), sora: undefined, rates: new Map() };

  // FX: each currency comes from exactly one source for its whole history
  // (engine/currencies.ts). If a currency's source changes, its file is
  // re-downloaded in full rather than spliced, so there is no artificial jump.
  const fetchers = { blended: fetchFx, ecb: deps.fetchEcbCrosses } as const;
  for (const source of ["blended", "ecb"] as const) {
    const codes = CURRENCIES.filter((c) => c.fxSource === source).map(
      (c) => c.code,
    );
    if (codes.length === 0) continue;
    const old = new Map(
      codes.map((code) => {
        const file = readJson(fxFileName(code), FxFileSchema);
        // A file from another source counts as missing: start over.
        return [code, file?.source === FX_SOURCES[source] ? file : undefined];
      }),
    );
    for (const code of codes) oldFx.set(code, old.get(code));
    const from = codes
      .map((code) => fetchStart(old.get(code)?.rows, FX_START, full))
      .sort()[0]!;
    log(`FX (${source}): fetching ${codes.length} currencies from ${from}`);
    const fresh = await fetchers[source](codes, from, today);
    for (const code of codes) {
      files.fx.set(code, {
        kind: "fx",
        quote: code,
        unit: `SGD per 1 ${code}`,
        source: FX_SOURCES[source],
        // Applied to the merged history, so older rows are cleaned too.
        rows: tradingObservations(
          merge(old.get(code)?.rows, fresh.get(code) ?? [], from),
          { dropRepeats: source === "blended" },
        ),
      });
    }
  }

  // BND is pegged 1:1 to SGD by the currency board, so it is a constant
  // series on the USD dates rather than noisy fetched data.
  const usd = files.fx.get("USD")!;
  for (const c of CURRENCIES.filter((c) => c.fxSource === "peg")) {
    files.fx.set(c.code, {
      kind: "fx",
      quote: c.code,
      unit: `SGD per 1 ${c.code}`,
      source: FX_SOURCES.peg,
      note: "Pegged at par, so every conversion strategy costs the same.",
      rows: usd.rows.map(([date]) => [date, 1, 1]),
    });
  }

  // SORA from MAS.
  const oldSora = readJson("rates/SORA.json", SoraFileSchema);
  const soraFrom = fetchStart(oldSora?.rows, SORA_START, full);
  log(`SORA: fetching from ${soraFrom}`);
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
  log(
    `USD-DFF: fetching from ${dffFrom} (${deps.fredApiKey ? "FRED API" : "public CSV, no key set"})`,
  );
  const dff: RateFile = {
    kind: "rate",
    series: "USD-DFF",
    unit: "decimal, annualised (ACT/360 as published)",
    source: FRED_SOURCE,
    rows: merge(
      oldDff?.rows,
      await fetchFredSeries("DFF", dffFrom, today, deps.fredApiKey),
      dffFrom,
    ),
  };
  files.rates.set("USD-DFF", dff);

  // A source that returns less than before (e.g. a default date range after
  // a site change) must not quietly delete rows that were already published.
  const shrunk: string[] = [];
  const compare = (
    name: string,
    old: readonly (readonly [string, ...unknown[]])[] | undefined,
    now: readonly (readonly [string, ...unknown[]])[],
  ) => {
    const before = old?.at(-1)?.[0];
    const after = now.at(-1)?.[0];
    if (before && (!after || after < before)) {
      shrunk.push(
        `${name} would end on ${after ?? "(empty)"}, before its committed last date ${before}`,
      );
    }
  };
  // (A currency whose source just changed has no "old" rows to compare.)
  for (const [code, old] of oldFx)
    compare(`SGD-${code}`, old?.rows, files.fx.get(code)!.rows);
  compare("SORA", oldSora?.rows, sora.rows);
  compare("USD-DFF", oldDff?.rows, dff.rows);
  if (shrunk.length) {
    throw new ValidationError(
      `Fetched data is shorter than what is committed:\n  ${shrunk.join("\n  ")}`,
    );
  }

  const { errors, warnings } = checkAll(files);
  if (warnings.length) {
    log(`${warnings.length} warning(s), e.g.:`);
    for (const w of warnings.slice(-10)) log(`  warn: ${w}`);
  }
  if (errors.length) {
    throw new ValidationError(
      `Validation failed (${errors.length} errors):\n` +
        errors.map((e) => `  ERROR: ${e}`).join("\n"),
    );
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
  log(`Done. ${changed} file(s) changed.`);
  return { changed };
}

const ATTRIBUTION: MetaFile["attribution"] = [
  {
    name: "European Central Bank euro reference rates (SGD crosses derived via EUR by SpotCheck)",
    url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
  },
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
