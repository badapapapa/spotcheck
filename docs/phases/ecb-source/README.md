# ECB reference rates as the FX source (post-launch change)

**Status:** merged into `main` in [`973a6c1`](https://github.com/badapapapa/spotcheck/commit/973a6c1) (19 Oct 2026).

## Why

Frankfurter's default _blended_ rate averages providers that fix at different times of day. That smooths daily moves: USD/SGD daily realised volatility from the blended feed was about two-thirds of the ECB single fixing's, and blended daily returns had lag-1 autocorrelation of about 0.4–0.5 (ECB: about 0). At weekly and monthly horizons the two agree within about 10% and 3%, so the planner was barely affected, but option premiums were understated by about a third.

## Decision

- **One source per currency, for its whole history.** No per-day splicing, so no artificial jumps where sources switch.
- **ECB** for currencies the ECB has published continuously from 13 Jan 2000 or earlier through today (27): AUD, BRL, CAD, CHF, CNY, CZK, DKK, EUR, GBP, HKD, HUF, IDR, ILS, INR, JPY, KRW, MXN, MYR, NOK, NZD, PHP, PLN, SEK, THB, TRY, USD, ZAR. BRL, CNY, ILS and INR start on 13 Jan 2000, so their planner windows start there; the rest start on 4 Jan 1999.
- **Blended** for the whole history of the rest (12): ISK (no ECB rates Dec 2008 – Feb 2018); ARS, MAD, TWD (ECB stopped Oct 2020); RUB (stopped Mar 2022); CLP, COP, KZT, MOP, PEN, SAR, VND (never published).
- **Peg:** BND stays a constant 1:1 series.
- SGD crosses are derived as (SGD per EUR) ÷ (currency per EUR), both from the same ~14:10 CET concertation.

## ECB terms

The [ECB disclaimer](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html) allows free reuse with the ECB cited as the source, and any modification must be stated. The SGD crosses are a modification, so the stored source string, the footer attribution ("European Central Bank euro reference rates (SGD crosses derived via EUR by SpotCheck)") and the methodology all say so. The ECB publishes the rates "for information purposes only" and discourages transaction use, which fits an educational tool.

## What changed

| Item                                                                                                                                            | Where                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| ECB fetcher and cross-rate maths                                                                                                                | `scripts/fetch/ecb.ts`                                                                                                   |
| Source per currency (`fxSource`) and UI labels                                                                                                  | `engine/currencies.ts`                                                                                                   |
| Pipeline fetches each currency from its own source; re-downloads a file in full if its source changes                                           | `scripts/fetch/pipeline.ts`, `scripts/fetch/sources.ts`                                                                  |
| Validation: each file's source must match the configuration                                                                                     | `scripts/fetch/validate.ts`                                                                                              |
| ECB repeats are kept (fresh fixings); the carry-forward filter applies to blended data only                                                     | `scripts/fetch/trading-days.ts`                                                                                          |
| Two reviewed TRY moves allowlisted (+41% on 22 Feb 2001 float, +36% on 21 Dec 2021 rebound)                                                     | `scripts/fetch/known-anomalies.ts`                                                                                       |
| Gap warnings now start at 6 days (5-day gaps are normal long weekends and TARGET holidays)                                                      | `scripts/fetch/schemas.ts`                                                                                               |
| Source label under planner results and on the hedging tab; methodology section "Where the rates come from"; ECB first in the footer attribution | `app/components/Planner.tsx`, `app/components/advanced/Advanced.tsx`, `app/components/Methodology.tsx`, `data/meta.json` |
| Option volatility lookback defaults to 250 trading days (60 and 90 still selectable)                                                            | `lib/url-state.ts`, `app/components/advanced/OptionPanel.tsx`                                                            |
| Notebook re-run, fixtures regenerated                                                                                                           | `notebooks/crosscheck.ipynb`, `engine/__tests__/fixtures/`                                                               |

## Old vs new (USD 15,000, 17 Oct 2026 → 1 Aug 2027, 6 tranches, 0.5% spread, ATM call)

|                                     | Old: blended, 60-day default | New: ECB, 250-day default |
| ----------------------------------- | ---------------------------- | ------------------------- |
| Spot (16 Oct 2026)                  | 1.28089                      | 1.27921                   |
| 60-day realised vol                 | 1.83%                        | 2.64%                     |
| 250-day realised vol                | 2.43%                        | 3.52%                     |
| Vol used by default                 | 1.83%                        | 3.52%                     |
| ATM premium                         | S$15 (0.081% of notional)    | S$91 (0.477%)             |
| Delta                               | 0.104                        | 0.255                     |
| Gamma                               | 8.57                         | 7.90                      |
| Vega (S$ per vol point, 15,000 USD) | S$30.58                      | S$54.06                   |
| Theta (S$ per day, 15,000 USD)      | S$0.04                       | S$0.02                    |
| Windows                             | 7,017                        | 6,913                     |
| Median: all at once                 | S$19,309                     | S$19,284                  |
| Median: equal tranches              | S$19,224                     | S$19,199                  |
| Median: wait until deadline         | S$19,151                     | S$19,130                  |
| Median: target rate                 | S$18,917                     | S$18,888                  |

Like-for-like lookbacks: blended 250-day gives S$38; ECB 60-day gives S$47. The planner medians move by S$21–29, almost all of it the 13 bp lower ECB spot. The premium is small in absolute terms because the forward is well below spot (USD rates above SGD rates), so an at-the-spot call is out of the money against the forward.

## Rule relaxed (third round)

The cut-off moved from 4 Jan 1999 to 13 Jan 2000, moving BRL, CNY, ILS and INR to the ECB (27 ECB, 12 blended). Weekly-vs-daily volatility on the full history:

| Currency | Source      | From        | Daily | Weekly | Difference |
| -------- | ----------- | ----------- | ----- | ------ | ---------- |
| USD      | ECB         | 4 Jan 1999  | 5.10% | 4.87%  | 4.6%       |
| CNY      | ECB         | 13 Jan 2000 | 4.80% | 4.59%  | 4.3%       |
| CNY      | old blended | 4 Jan 1999  | 3.04% | 4.05%  | 33.2%      |
| INR      | ECB         | 13 Jan 2000 | 6.00% | 5.75%  | 4.2%       |
| INR      | old blended | 4 Jan 1999  | 3.79% | 5.18%  | 36.6%      |

The test now covers USD, CNY and INR (limit 15%).

## Review fixes (second round)

- **EUR label:** "Source: ECB euro reference rate." (the ECB publishes SGD per EUR directly; only the other ECB currencies are crosses).
- **Small SGD values:** amounts under S$100 show cents; S$100 and above stay whole dollars. Axis ticks use 1/2/5 steps with decimals chosen from the spacing (`lib/ticks.ts`), on the outcome chart, sample path, payoff and Greek charts. Checked with JPY, KRW, IDR and VND at 15,000 units.
- **Switching currency:** keeps the SGD value of the amount, converted at both currencies' rates on the start date and rounded to 3 significant figures (15,000 USD → about 394,000,000 VND), never below 1 unit. Shared links are never converted.
- **First load (USD):** 18 requests, 471 KB gzipped; the only data file is `data/fx/SGD-USD.json` (81.6 KB gzipped, 290 KB uncompressed; ECB crosses at 8 significant figures compress less well than the blended file's 68 KB).

## Tests added

- `scripts/fetch/__tests__/ecb.test.ts`: cross maths, EUR, fetcher pairs each rate with SGD on the same day, the exact 23/16/1 split, every committed file matches its configured source, validation rejects a mismatched source, attribution says the crosses are derived.
- `engine/__tests__/stats.test.ts`: **ECB-sourced USD, CNY and INR weekly-return volatility over their full history is within 15% of the daily figure** (option B as a check; it would fail on the blended data, where weekly is ~30% above daily).
- `lib/__tests__/url-state.test.ts`: 60/90/250 lookbacks, 250 default.
- e2e: source labels on the planner (USD, EUR, BRL as ECB; VND as blended) and footer attribution; hedging tab shows the ECB source and defaults to 250 days.
