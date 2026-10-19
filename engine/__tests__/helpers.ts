// Test helpers: synthetic series and the committed data files.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fxSeries, rateSeries, soraSeries } from "@/lib/series.ts";
import {
  FxFileSchema,
  RateFileSchema,
  SoraFileSchema,
} from "@/scripts/fetch/schemas.ts";
import { addDays } from "../calendar.ts";
import type { Scenario, Series } from "../types.ts";

const DATA = join(import.meta.dirname, "..", "..", "data");
const load = (rel: string) => JSON.parse(readFileSync(join(DATA, rel), "utf8"));

/** Any currency's committed FX file as a Series. */
export const loadFx = (code: string): Series =>
  fxSeries(FxFileSchema.parse(load(`fx/SGD-${code}.json`)));

export const loadUsd = (): Series =>
  fxSeries(FxFileSchema.parse(load("fx/SGD-USD.json")));
export const loadSora = (): Series =>
  soraSeries(SoraFileSchema.parse(load("rates/SORA.json")));
export const loadDff = (): Series =>
  rateSeries(RateFileSchema.parse(load("rates/USD-DFF.json")));

/** Daily series from `start`, one value per calendar day (or per `values`). */
export function daily(start: string, values: number[]): Series {
  return { dates: values.map((_, i) => addDays(start, i)), values };
}

/** Weekdays-only series: values are assigned to Mon–Fri dates from `start`. */
export function weekdays(start: string, values: number[]): Series {
  const dates: string[] = [];
  let d = start;
  while (dates.length < values.length) {
    const dow = new Date(d + "T00:00:00Z").getUTCDay();
    if (dow !== 0 && dow !== 6) dates.push(d);
    d = addDays(d, 1);
  }
  return { dates, values };
}

export const baseScenario: Scenario = {
  currency: "USD",
  amount: 15_000,
  startDate: "2024-01-01",
  deadline: "2024-07-01",
  tranches: 6,
  spread: 0.005,
  targetRate: 1.3,
};
