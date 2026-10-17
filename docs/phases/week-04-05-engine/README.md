# Weeks 4–5 · Phase 2: Engine

**Status:** built on branch `phase-2-engine` (stacked on `phase-1-data`), opened as a PR for approval.

## What was built

| Module                       | What it does                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/types.ts`            | `ISODate`, `Series`, `Scenario`, `StrategyId`, `Conversion`, `StrategyResult` (plan §3.1)                                                                                                                                       |
| `engine/calendar.ts`         | `rateOn` (next available, for executing), `rateAsOf` (on or before, for decisions), tranche dates, ACT/365 year fractions, month arithmetic; UTC only                                                                           |
| `engine/strategies.ts`       | Lump sum, equal tranches, wait, target-with-deadline-fallback; spread on every conversion                                                                                                                                       |
| `engine/replay.ts`           | Every historical start date, all four strategies, summary stats, share of windows beating lump sum, sample window for the path view                                                                                             |
| `engine/stats.ts`            | Percentiles (numpy/Excel `PERCENTILE.INC` method), summaries, realised volatility: log returns between consecutive trading observations over the N trading days strictly before the pricing date, × √252 (rejects weekend rows) |
| `engine/rates.ts`            | MAS compounding of daily SORA (ACT/365) and USD fed funds (ACT/360 → ACT/365), trailing tenor rates, continuous-rate conversion                                                                                                 |
| `engine/forwards.ts`         | Covered interest parity, forward points, pricing a forward from data known on the day, hedge cost                                                                                                                               |
| `engine/hedge-replay.ts`     | Unhedged vs forward-hedged cost over every window with rate history (option hedge plugs in during Phase 4)                                                                                                                      |
| `lib/series.ts`              | Converts validated data files into engine `Series`                                                                                                                                                                              |
| `notebooks/crosscheck.ipynb` | Independent numpy reimplementation of compounding and strategies; writes the fixtures the TS tests check                                                                                                                        |

## Test results

`npm run check`: 89 tests pass, engine coverage 97.7% statements (90% enforced in CI).

| Required test (plan §3.8)                            | Where                                                 | Result                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Flat history → all strategies equal                  | `strategies.test.ts`, `replay.test.ts`                | ✅                                                                                                        |
| `tranches(k=1)` = `lumpSum`                          | `strategies.test.ts`                                  | ✅ identical conversions                                                                                  |
| Linear in amount                                     | `strategies.test.ts`                                  | ✅                                                                                                        |
| Look-ahead guard                                     | `replay.test.ts`, `forwards.test.ts`, `stats.test.ts` | ✅ altering data after day _d_ changes nothing decided by _d_ (3,000+ windows compared)                   |
| Calendar snapping                                    | `calendar.test.ts`                                    | ✅ weekend → Monday for trades, → Friday for decisions                                                    |
| **MAS compounded SORA back-check (Gate 2)**          | `rates.test.ts`                                       | ✅ 36 sampled fixture values within 1 bp; **all 4,600+ published values since Aug 2020** within 0.0101 bp |
| Forwards: r_d = r_f → F = S; r_d > r_f → F > S       | `forwards.test.ts`                                    | ✅                                                                                                        |
| Percentiles vs a hand-computed array                 | `stats.test.ts`                                       | ✅                                                                                                        |
| Python cross-check                                   | `crosscheck.test.ts`                                  | ✅ compounding to 1e-12, strategies to 1e-9 relative                                                      |
| Engine purity (no React, network, clock, randomness) | `purity.test.ts`                                      | ✅                                                                                                        |
| Performance (< 300 ms, 25+ years daily USD)          | `replay.test.ts`                                      | ✅ about 7,000 trading-day windows × 12 tranches                                                          |

## Convention findings (please review)

1. **MAS compounding window.** Compounded SORA published on date _P_ compounds daily SORA over **[P − tenor, P)**, with each rate applying for the calendar days until the next business day. Matching on the _value_ date instead is off by up to 22 bp. That makes the forward proxy on day _d_ use SORA through _d − 1_, published on the morning of _d_: no look-ahead.
2. **USD fed funds is ACT/360.** DFF is compounded on a 360-day basis and the result restated as a simple ACT/365 rate, so both legs of the forward use the same convention.
3. **Normalising history (a plan ambiguity).** The plan says to normalise to "SGD per 1,000 foreign units". On its own that keeps the 1999 rate level (1.70 SGD/USD) mixed in with today's (1.30). The engine divides each window's cost by _that window's_ starting spot, then rescales by the user's amount × today's spot. So every outcome reads "what this would cost if the coming months moved the way that window did". Lump sum is then always exactly amount × spot × (1 + spread).
4. The cross-check caught a bug in my first _Python_ draft (daily compounding instead of simple interest per rate period). The TS engine was already right, since it matches MAS.
5. MAS's CSV also contains back-calculated compounded SORA before Aug 2020; the back-check uses only the officially published period.

## Trading-day fix (added after review)

Frankfurter's blended feed had weekend rows, so windows started on ~365 days a year and volatility was annualised from calendar-day moves. The data now holds trading observations only (Phase 1), `realisedVol` uses consecutive trading observations × √252 and refuses weekend rows, and tests check that replay windows start only on real observations (about 252–262 a year).

## Dependencies added

- `@vitest/coverage-v8` (dev): measures and enforces the 90% engine coverage the plan's definition of done asks for.
