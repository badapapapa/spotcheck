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

function load<T>(path: string, parse: (json: unknown) => T): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`/data/${path}`)
      .then((res) => {
        if (!res.ok)
          throw new Error(`Couldn't load ${path} (HTTP ${res.status})`);
        return res.json();
      })
      .then(parse);
    // Don't cache failures, so a retry can succeed.
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export const loadFx = (code: string): Promise<Series> =>
  load(fxFileName(code), (j) => fxSeries(FxFileSchema.parse(j)));

export const loadSora = (): Promise<Series> =>
  load("rates/SORA.json", (j) => soraSeries(SoraFileSchema.parse(j)));

export const loadRate = (series: string): Promise<Series> =>
  load(`rates/${series}.json`, (j) => rateSeries(RateFileSchema.parse(j)));

export const loadMeta = (): Promise<MetaFile> =>
  load("meta.json", (j) => MetaFileSchema.parse(j));
