// The source string stored in each FX file, by source kind. Validation checks
// every file's source matches its currency's configured source.

import type { FxSource } from "../../engine/currencies.ts";
import { ECB_SOURCE } from "./ecb.ts";
import { FRANKFURTER_SOURCE } from "./frankfurter.ts";

export const FX_SOURCES: Record<FxSource, string> = {
  ecb: ECB_SOURCE,
  blended: FRANKFURTER_SOURCE,
  peg: "Constant: pegged 1:1 to SGD under the Currency Interchangeability Agreement",
};
