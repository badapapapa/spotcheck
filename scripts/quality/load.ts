// The committed FX series, read through the pipeline's own Zod schema.

import { CURRENCIES, fxFileName } from "../../engine/currencies.ts";
import { readJson } from "../fetch/io.ts";
import { FxFileSchema } from "../fetch/schemas.ts";
import type { Series } from "./features.ts";

/** Every FX series in data/fx, as SGD per 1 unit, oldest first. */
export function loadSeries(): Series[] {
  return CURRENCIES.map((c) => {
    const file = readJson(fxFileName(c.code), FxFileSchema);
    if (!file) throw new Error(`data/${fxFileName(c.code)} is missing.`);
    return {
      code: c.code,
      dates: file.rows.map((r) => r[0]),
      values: file.rows.map((r) => r[2]),
    };
  });
}
