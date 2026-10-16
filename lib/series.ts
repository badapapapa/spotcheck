// Turns validated data files into the engine's Series type.

import type { Series } from "@/engine/types.ts";
import type { FxFile, RateFile, SoraFile } from "@/scripts/fetch/schemas.ts";

/** FX as SGD per 1 foreign unit (the inverted column). */
export function fxSeries(file: FxFile): Series {
  return {
    dates: file.rows.map((r) => r[0]),
    values: file.rows.map((r) => r[2]),
  };
}

/** Daily SORA by value date, as a decimal. */
export function soraSeries(file: SoraFile): Series {
  return {
    dates: file.rows.map((r) => r[0]),
    values: file.rows.map((r) => r[2]),
  };
}

export function rateSeries(file: RateFile): Series {
  return {
    dates: file.rows.map((r) => r[0]),
    values: file.rows.map((r) => r[1]),
  };
}
