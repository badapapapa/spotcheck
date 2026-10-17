// Moves and gaps that trip the sanity checks but were reviewed and are real.
// Each entry needs a note saying what happened. Add entries only after
// checking the source data by hand.

import type { KnownAnomaly } from "./schemas.ts";

export const KNOWN_ANOMALIES: readonly KnownAnomaly[] = [
  {
    series: "SGD-ARS",
    date: "2023-12-14",
    kind: "jump",
    note: "Argentina devalued the official peso rate from about 366 to 800 per USD on 13 Dec 2023 (Frankfurter: 273.23 → 601.65 ARS per SGD).",
  },
  {
    series: "SGD-TRY",
    date: "2001-02-22",
    kind: "jump",
    note: "Turkey abandoned its crawling peg and floated the lira during the February 2001 banking crisis; the ECB reference rate moved about 41% that day.",
  },
  {
    series: "SGD-TRY",
    date: "2021-12-21",
    kind: "jump",
    note: "The lira rebounded about 36% the day after Turkey announced its FX-protected deposit scheme (20 Dec 2021).",
  },
];
