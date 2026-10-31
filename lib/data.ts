// Loads the static data files in the browser and validates each with the same
// Zod schemas the daily job uses, before anything touches the engine.

import { fxFileName } from "@/engine/currencies.ts";
import type { Series } from "@/engine/types.ts";
import {
  FxFileSchema,
  MetaFileSchema,
  RateFileSchema,
  SoraFileSchema,
  type MetaFile,
} from "@/scripts/fetch/schemas.ts";
import { fxSeries, rateSeries, soraSeries } from "./series.ts";

const cache = new Map<string, Promise<unknown>>();

/** A request that hasn't answered by then counts as failed. */
export const LOAD_TIMEOUT_MS = 20_000;

/**
 * A failed data load, with a message for people. The technical detail (HTTP
 * status, JSON position, the Zod report) goes to the console, never the page.
 */
export class DataLoadError extends Error {}

function load<T>(
  path: string,
  what: string,
  parse: (json: unknown) => T,
): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
    p = fetch(`/data/${path}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(parse)
      .catch((err: unknown) => {
        console.error(`SpotCheck couldn't load /data/${path}:`, err);
        throw new DataLoadError(
          controller.signal.aborted
            ? `The ${what} took too long to load. Check your connection and try again.`
            : `Couldn't load the ${what}. Check your connection and try again.`,
        );
      })
      .finally(() => clearTimeout(timer));
    // Don't cache failures, so a retry can succeed.
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export const loadFx = (code: string): Promise<Series> =>
  load(fxFileName(code), `${code} rate history`, (j) =>
    fxSeries(FxFileSchema.parse(j)),
  );

export const loadSora = (): Promise<Series> =>
  load("rates/SORA.json", "SGD interest-rate history (SORA)", (j) =>
    soraSeries(SoraFileSchema.parse(j)),
  );

export const loadRate = (series: string): Promise<Series> =>
  load(`rates/${series}.json`, "foreign interest-rate history", (j) =>
    rateSeries(RateFileSchema.parse(j)),
  );

export const loadMeta = (): Promise<MetaFile> =>
  load("meta.json", "data summary", (j) => MetaFileSchema.parse(j));
