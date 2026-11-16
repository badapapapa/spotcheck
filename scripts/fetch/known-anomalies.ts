// Moves and gaps that trip the sanity checks but were reviewed and are real.
// Each entry needs a note saying what happened. Add entries only after
// checking the source data by hand.

import type { KnownAnomaly } from "./schemas.ts";

export const KNOWN_ANOMALIES: readonly KnownAnomaly[] = [
  {
    series: "SGD-BRL",
    date: "2000-02-11",
    kind: "upstream-error",
    note: "The ECB published EUR/BRL 2.0141 on 11 Feb 2000, between 1.7501 (10 Feb) and 1.7509 (14 Feb): a one-day 15% spike that fully reverses. Banco Central do Brasil's PTAX USD/BRL shows no such move (1.7695, 1.7647, 1.7699 on 10, 11 and 14 Feb). Dropped, so the day is treated like a holiday. Checked 31 Oct 2026.",
  },
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
  {
    series: "SGD-BRL",
    date: "2026-10-26",
    kind: "jump",
    note: "Real move: post-runoff sell-off; Al Jazeera reports the real fell 12% against the US dollar in spot trading on 26 Oct 2026, with a partial rebound reported after. Sources: https://aljazeera.com/economy/2026/10/26/brazils-real-sinks-after-lulas-re-election-victory and https://tradingeconomics.com/brazil/currency/news/595076. Raised by the data-quality detector (ECB rate −9.5% against SGD, USD and MXN flat); added 16 Nov 2026.",
  },
];
