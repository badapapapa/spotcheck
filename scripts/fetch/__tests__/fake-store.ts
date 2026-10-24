// A small, fixed, in-memory data set for testing the pipeline without
// touching the real data/ files (which the daily job changes every day).
// Every currency, SORA and DFF has September 2026 weekday data that passes
// all validation checks, so a test can break exactly one thing and know
// which check fires.

import { CURRENCIES, fxFileName } from "../../../engine/currencies.ts";
import type { readJson } from "../io.ts";
import type { FxRow, RateRow, SoraRow } from "../schemas.ts";
import { FX_SOURCES } from "../sources.ts";
import { isWeekend } from "../trading-days.ts";

/** Weekdays from 1 to 30 September 2026. */
export const FAKE_DAYS: string[] = Array.from(
  { length: 30 },
  (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`,
).filter((d) => !isWeekend(d));

export const FAKE_LAST_DAY = FAKE_DAYS.at(-1)!; // Wed 30 Sep 2026
/** The next weekday after the fixture ends, for "new" rows. */
export const FAKE_NEXT_DAY = "2026-10-01";
/** A "today" after the fixture, so fetchers are asked for recent days. */
export const FAKE_TODAY = "2026-10-01";

/** A rate that changes a little every day (no repeats), consistently inverted. */
function fxRows(base: number): FxRow[] {
  return FAKE_DAYS.map((date, i) => {
    const raw = Number((base * (1 + 0.001 * i)).toPrecision(8));
    return [date, raw, Number((1 / raw).toPrecision(8))];
  });
}

export function fakeFiles(): Map<string, unknown> {
  const files = new Map<string, unknown>();
  CURRENCIES.forEach((c, k) => {
    files.set(fxFileName(c.code), {
      kind: "fx",
      quote: c.code,
      unit: `SGD per 1 ${c.code}`,
      source: FX_SOURCES[c.fxSource],
      rows:
        c.fxSource === "peg"
          ? FAKE_DAYS.map((d) => [d, 1, 1])
          : fxRows(0.5 + k),
    });
  });
  const sora: SoraRow[] = FAKE_DAYS.map((d, i) => [
    d,
    FAKE_DAYS[i + 1] ?? FAKE_NEXT_DAY,
    0.012,
    null,
    null,
    null,
  ]);
  files.set("rates/SORA.json", {
    kind: "sora",
    unit: "decimal",
    source: "test",
    rows: sora,
  });
  const dff: RateRow[] = Array.from({ length: 30 }, (_, i) => [
    `2026-09-${String(i + 1).padStart(2, "0")}`,
    0.0433,
  ]);
  files.set("rates/USD-DFF.json", {
    kind: "rate",
    series: "USD-DFF",
    unit: "decimal",
    source: "test",
    rows: dff,
  });
  return files;
}

/** readJson over an in-memory store, validated with the same schemas. */
export function fakeReadJson(files: Map<string, unknown>): typeof readJson {
  return (path, schema) => {
    const json = files.get(path);
    return json === undefined ? undefined : schema.parse(json);
  };
}

/** A fake FX source that re-serves the store's rows from `from` on. */
export function reserveFx(files: Map<string, unknown>) {
  return async (quotes: readonly string[], from: string) =>
    new Map(
      quotes.map((q) => [
        q,
        (files.get(fxFileName(q)) as { rows: FxRow[] }).rows.filter(
          (r) => r[0] >= from,
        ),
      ]),
    );
}
