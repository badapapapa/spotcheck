# Weeks 2–3 · Phase 1: Data pipeline

**Status:** built on branch `phase-1-data`, opened as a PR for approval.

## What was built

| Item                                                                                                                             | Where                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Frankfurter fetcher (all 40 currencies, chunked by year, polite pacing, honours `Retry-After`)                                   | `scripts/fetch/frankfurter.ts`                            |
| The single tested inversion: foreign per SGD → SGD per foreign unit                                                              | `invertFrankfurterRate` in `scripts/fetch/frankfurter.ts` |
| MAS SORA fetcher (daily SORA + published 1M/3M/6M compounded SORA)                                                               | `scripts/fetch/mas.ts`                                    |
| FRED DFF fetcher (API with key, or FRED's public CSV without one)                                                                | `scripts/fetch/fred.ts`                                   |
| Zod schemas + sanity checks (ascending dates, gaps, ±30% FX moves, rates in [−1%, 25%], inversion consistency)                   | `scripts/fetch/schemas.ts`                                |
| Reviewed exceptions list (one so far: ARS devaluation, 14 Dec 2023)                                                              | `scripts/fetch/known-anomalies.ts`                        |
| Entry points: `npm run fetch-data` (`--full` to re-download all history), `npm run validate-data` (also part of `npm run check`) | `scripts/fetch/run.ts`, `scripts/fetch/validate.ts`       |
| Daily job: 03:00 UTC (11:00 SGT), manual dispatch, commits `data: update YYYY-MM-DD` as the Actions bot                          | `.github/workflows/fetch-data.yml`                        |
| 40-currency config with names, flags, pegged flag, rate-series link                                                              | `engine/currencies.ts`                                    |
| Tests: inversion (0.78015 → 1.28180), MAS/FRED parsing, every sanity check, corrupted-file rejection                             | `scripts/fetch/__tests__/`                                |

## Data committed

All files store one observation per line so daily diffs are small. Total 14 MB in the repo; the browser downloads one currency at a time (SGD-USD is about 95 KB gzipped).

| Series  | First      | Last       | Rows  | Size   |
| ------- | ---------- | ---------- | ----- | ------ |
| SGD-USD | 1999-01-04 | 2026-10-16 | 10100 | 373 KB |
| SGD-CAD | 1999-01-04 | 2026-10-16 | 10148 | 375 KB |
| SGD-MXN | 1999-01-04 | 2026-10-16 | 8667  | 330 KB |
| SGD-BRL | 1999-01-04 | 2026-10-16 | 8842  | 326 KB |
| SGD-ARS | 1999-01-04 | 2026-10-16 | 7866  | 296 KB |
| SGD-CLP | 1999-01-04 | 2026-10-16 | 7710  | 300 KB |
| SGD-COP | 1999-01-04 | 2026-10-16 | 9011  | 368 KB |
| SGD-PEN | 1999-01-04 | 2026-10-16 | 7684  | 284 KB |
| SGD-CNY | 1999-01-04 | 2026-10-16 | 9949  | 367 KB |
| SGD-HKD | 1999-01-04 | 2026-10-16 | 10073 | 372 KB |
| SGD-MOP | 1999-01-04 | 2026-10-16 | 7975  | 294 KB |
| SGD-JPY | 1999-01-04 | 2026-10-16 | 10148 | 383 KB |
| SGD-KRW | 1999-01-04 | 2026-10-16 | 9610  | 375 KB |
| SGD-TWD | 1999-01-04 | 2026-10-16 | 9555  | 364 KB |
| SGD-INR | 1999-01-04 | 2026-10-16 | 10020 | 380 KB |
| SGD-IDR | 1999-01-04 | 2026-10-16 | 8928  | 347 KB |
| SGD-MYR | 1999-01-04 | 2026-10-16 | 9565  | 353 KB |
| SGD-PHP | 1999-01-04 | 2026-10-16 | 9155  | 347 KB |
| SGD-THB | 1999-01-04 | 2026-10-16 | 9470  | 359 KB |
| SGD-VND | 1999-01-04 | 2026-10-16 | 8741  | 346 KB |
| SGD-KZT | 1999-01-04 | 2026-10-16 | 10065 | 385 KB |
| SGD-ILS | 1999-01-04 | 2026-10-16 | 8924  | 329 KB |
| SGD-SAR | 1999-01-04 | 2026-10-16 | 10020 | 370 KB |
| SGD-TRY | 1999-01-04 | 2026-10-16 | 9486  | 352 KB |
| SGD-MAD | 1999-01-04 | 2026-10-16 | 7718  | 285 KB |
| SGD-ZAR | 1999-01-04 | 2026-10-16 | 10096 | 379 KB |
| SGD-AUD | 1999-01-04 | 2026-10-16 | 10148 | 375 KB |
| SGD-NZD | 1999-01-04 | 2026-10-16 | 9497  | 351 KB |
| SGD-EUR | 1999-01-04 | 2026-10-16 | 10148 | 375 KB |
| SGD-CZK | 1999-01-04 | 2026-10-16 | 9437  | 366 KB |
| SGD-DKK | 1999-01-04 | 2026-10-16 | 10148 | 375 KB |
| SGD-HUF | 1999-01-04 | 2026-10-16 | 9439  | 367 KB |
| SGD-ISK | 1999-01-04 | 2026-10-16 | 9515  | 357 KB |
| SGD-NOK | 1999-01-04 | 2026-10-16 | 10148 | 374 KB |
| SGD-PLN | 1999-01-04 | 2026-10-16 | 9873  | 364 KB |
| SGD-RUB | 1999-01-04 | 2026-10-16 | 10028 | 383 KB |
| SGD-SEK | 1999-01-04 | 2026-10-16 | 10148 | 375 KB |
| SGD-CHF | 1999-01-04 | 2026-10-16 | 10148 | 375 KB |
| SGD-GBP | 1999-01-04 | 2026-10-16 | 10148 | 375 KB |
| SGD-BND | 1999-01-04 | 2026-10-16 | 10100 | 237 KB |
| SORA    | 2005-07-01 | 2026-10-15 | 5344  | 357 KB |
| USD-DFF | 2005-01-01 | 2026-10-14 | 7957  | 209 KB |

FX rows include weekends because Frankfurter's blended feed publishes them. SORA has only Singapore business days.

## Findings and decisions (please review)

1. **MAS has no JSON API for SORA.** The developer-portal page linked in the plan now returns 404. The working source is the MAS statistics page [Domestic Interest Rates](https://eservices.mas.gov.sg/Statistics/dir/DomesticInterestRates.aspx). Its "Download" button returns CSV with daily SORA _and_ the published 1M/3M/6M compounded SORA, back to 1 Jul 2005, with no key. `mas.ts` submits that form the way a browser does and checks that the columns haven't changed. No manual CSV download (the plan's fallback) was needed.
2. **FRED key is optional.** The official API needs a key; FRED's public CSV of the same series doesn't. The fetcher uses the API when `FRED_API_KEY` is set and the CSV otherwise, which is how the backfill was done. You can still add the secret as the plan says; nothing else changes.
3. **BND** is stored as a constant 1.0 on the USD dates (currency board peg), flagged with a note in the file.
4. **Gap warnings:** 31 SORA gaps of 5 days, all Lunar New Year, Hari Raya, Labour Day or National Day long weekends. They're logged, not errors.
5. Frankfurter rate-limits bursts (HTTP 429, `Retry-After: 40–60s`); the job waits and retries, so a full backfill takes about 3–4 minutes. Daily runs make one request per source.

## [BEN] to do

- Optional: create a free FRED key at fredaccount.stlouisfed.org and add it as the repo secret `FRED_API_KEY` (Settings → Secrets and variables → Actions).
- Gate 1 asks for 7 consecutive successful daily runs. That clock starts once this PR is merged into `main` (scheduled workflows only run from the default branch).
