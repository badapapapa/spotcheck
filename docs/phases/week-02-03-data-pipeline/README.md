# Weeks 2–3 · Phase 1: Data pipeline

**Status:** merged into `main` in [`d1c2fe0`](https://github.com/badapapapa/spotcheck/commit/d1c2fe0).

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

All files store one observation per line so daily diffs are small. Total 11 MB in the repo (15 MB before weekend rows were removed); the browser downloads one currency at a time.

| Series  | First      | Last       | Rows | Size   |
| ------- | ---------- | ---------- | ---- | ------ |
| SGD-USD | 1999-01-04 | 2026-10-16 | 7222 | 267 KB |
| SGD-CAD | 1999-01-04 | 2026-10-16 | 7220 | 267 KB |
| SGD-MXN | 1999-01-04 | 2026-10-16 | 7239 | 275 KB |
| SGD-BRL | 1999-01-04 | 2026-10-16 | 7210 | 266 KB |
| SGD-ARS | 1999-01-04 | 2026-10-16 | 7198 | 271 KB |
| SGD-CLP | 1999-01-04 | 2026-10-16 | 7218 | 281 KB |
| SGD-COP | 1999-01-04 | 2026-10-16 | 7226 | 295 KB |
| SGD-PEN | 1999-01-04 | 2026-10-16 | 7184 | 265 KB |
| SGD-CNY | 1999-01-04 | 2026-10-16 | 7209 | 266 KB |
| SGD-HKD | 1999-01-04 | 2026-10-16 | 7214 | 266 KB |
| SGD-MOP | 1999-01-04 | 2026-10-16 | 7125 | 263 KB |
| SGD-JPY | 1999-01-04 | 2026-10-16 | 7184 | 271 KB |
| SGD-KRW | 1999-01-04 | 2026-10-16 | 7229 | 282 KB |
| SGD-TWD | 1999-01-04 | 2026-10-16 | 7185 | 274 KB |
| SGD-INR | 1999-01-04 | 2026-10-16 | 7210 | 273 KB |
| SGD-IDR | 1999-01-04 | 2026-10-16 | 7120 | 277 KB |
| SGD-MYR | 1999-01-04 | 2026-10-16 | 7179 | 265 KB |
| SGD-PHP | 1999-01-04 | 2026-10-16 | 7194 | 273 KB |
| SGD-THB | 1999-01-04 | 2026-10-16 | 7192 | 273 KB |
| SGD-VND | 1999-01-04 | 2026-10-16 | 7128 | 281 KB |
| SGD-KZT | 1999-01-04 | 2026-10-16 | 7154 | 274 KB |
| SGD-ILS | 1999-01-04 | 2026-10-16 | 7205 | 266 KB |
| SGD-SAR | 1999-01-04 | 2026-10-16 | 7178 | 265 KB |
| SGD-TRY | 1999-01-04 | 2026-10-16 | 7209 | 268 KB |
| SGD-MAD | 1999-01-04 | 2026-10-16 | 7231 | 267 KB |
| SGD-ZAR | 1999-01-04 | 2026-10-16 | 7242 | 272 KB |
| SGD-AUD | 1999-01-04 | 2026-10-16 | 7208 | 266 KB |
| SGD-NZD | 1999-01-04 | 2026-10-16 | 7210 | 266 KB |
| SGD-EUR | 1999-01-04 | 2026-10-16 | 7229 | 267 KB |
| SGD-CZK | 1999-01-04 | 2026-10-16 | 7241 | 281 KB |
| SGD-DKK | 1999-01-04 | 2026-10-16 | 7213 | 266 KB |
| SGD-HUF | 1999-01-04 | 2026-10-16 | 7204 | 280 KB |
| SGD-ISK | 1999-01-04 | 2026-10-16 | 7149 | 269 KB |
| SGD-NOK | 1999-01-04 | 2026-10-16 | 7231 | 267 KB |
| SGD-PLN | 1999-01-04 | 2026-10-16 | 7214 | 266 KB |
| SGD-RUB | 1999-01-04 | 2026-10-16 | 7231 | 276 KB |
| SGD-SEK | 1999-01-04 | 2026-10-16 | 7227 | 267 KB |
| SGD-CHF | 1999-01-04 | 2026-10-16 | 7230 | 267 KB |
| SGD-GBP | 1999-01-04 | 2026-10-16 | 7217 | 266 KB |
| SGD-BND | 1999-01-04 | 2026-10-16 | 7222 | 170 KB |
| SORA    | 2005-07-01 | 2026-10-15 | 5344 | 357 KB |
| USD-DFF | 2005-01-01 | 2026-10-15 | 7958 | 209 KB |

**FX rows are trading observations only.** Frankfurter's blended feed also has Saturday and Sunday rows (from sources that publish at weekends) and occasionally repeats a rate over a holiday. Ingestion keeps only Monday–Friday rows whose rate changed (`scripts/fetch/trading-days.ts`), and validation rejects weekend rows and carried-forward repeats. Major currencies now have about 258–261 observations a year. SORA has only Singapore business days.

## Findings and decisions (please review)

1. **MAS has no JSON API for SORA.** The developer-portal page linked in the plan now returns 404. The working source is the MAS statistics page [Domestic Interest Rates](https://eservices.mas.gov.sg/Statistics/dir/DomesticInterestRates.aspx). Its "Download" button returns CSV with daily SORA _and_ the published 1M/3M/6M compounded SORA, back to 1 Jul 2005, with no key. `mas.ts` submits that form the way a browser does and checks that the columns haven't changed. No manual CSV download (the plan's fallback) was needed.
2. **FRED key is optional.** The official API needs a key; FRED's public CSV of the same series doesn't. The fetcher uses the API when `FRED_API_KEY` is set and the CSV otherwise, which is how the backfill was done. You can still add the secret as the plan says; nothing else changes.
3. **BND** is stored as a constant 1.0 on the USD dates (currency board peg), flagged with a note in the file.
4. **Gap warnings:** 31 SORA gaps of 5 days, all Lunar New Year, Hari Raya, Labour Day or National Day long weekends. They're logged, not errors.
5. Frankfurter rate-limits bursts (HTTP 429, `Retry-After: 40–60s`); the job waits and retries, so a full backfill takes about 3–4 minutes. Daily runs make one request per source.

## [BEN] to do

- Optional: create a free FRED key at fredaccount.stlouisfed.org and add it as the repo secret `FRED_API_KEY` (Settings → Secrets and variables → Actions).
- Gate 1 asks for 7 consecutive successful daily runs. Scheduled workflows only run from the default branch, so the clock started when this phase was merged into `main` on 17 Oct 2026; see the repository's Actions tab for the run history.
