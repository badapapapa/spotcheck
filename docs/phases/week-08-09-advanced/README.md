# Weeks 8–9 · Phase 4: Advanced tab

**Status:** merged into `main` in [`a4e3f70`](https://github.com/badapapapa/spotcheck/commit/a4e3f70).

## What was built

| Item                                                                                                                                                                                                           | Where                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Normal CDF (Hart 1968 / West 2005, double precision) and density                                                                                                                                               | `engine/options.ts`                                                           |
| Garman-Kohlhagen call and put on the foreign currency, closed-form delta, gamma, vega, theta                                                                                                                   | `engine/options.ts`                                                           |
| Option-hedged cost: premium + min(S_T, K) × (1 + spread)                                                                                                                                                       | `optionHedgedCost` in `engine/options.ts`                                     |
| Historical option hedge: each window priced with realised volatility from the 60/90 observations _before_ its start, rates as for the forward                                                                  | `makeOptionPricer` in `engine/hedge-replay.ts`                                |
| `/advanced` page with the scenario carried over in the URL                                                                                                                                                     | `app/advanced/page.tsx`, `app/components/advanced/Advanced.tsx`               |
| Panel 1: today's forward: spot, forward, points, SORA and fed-funds rates with their dates, carry in SGD                                                                                                       | `app/components/advanced/ForwardPanel.tsx`                                    |
| Panel 2: strike slider (80–120% of spot), volatility (realised 60/90-day, or override), premium in SGD and % of notional, payoff-at-deadline chart (unhedged vs forward vs option), Greeks with charts vs spot | `app/components/advanced/OptionPanel.tsx`                                     |
| Panel 3: unhedged vs forward vs option cost distributions over every window since 2006 (**option-hedged history was a Phase 5 item, done here**)                                                               | `Advanced.tsx`, `RangeChart` in `app/components/DistributionChart.tsx`        |
| Planner / Hedging tabs in the header, keeping the scenario                                                                                                                                                     | `app/components/SiteNav.tsx`                                                  |
| USD-only notice for currencies without interest-rate data                                                                                                                                                      | `Advanced.tsx`                                                                |
| Notebook section 3: scipy reimplementation of GK price and Greeks for 20 random inputs                                                                                                                         | `notebooks/crosscheck.ipynb` → `engine/__tests__/fixtures/gk-crosscheck.json` |
| E2E tests for the hedging tab                                                                                                                                                                                  | `e2e/advanced.spec.ts`                                                        |

## Gate 4 results

| Check                                                                    | Result                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| GK cross-check vs scipy, 20 random inputs, price + put + 4 Greeks        | ✅ all within 1e-6                                      |
| Greeks vs central finite differences (3 cases)                           | ✅                                                      |
| Textbook reference S=K=1.60, r_d=8%, r_f=11%, σ=20%, T=0.5 → C ≈ 0.07505 | ✅ 0.075053 (notebook agrees)                           |
| Put-call parity to 1e-10                                                 | ✅                                                      |
| Price increasing in σ and S; 0 < delta < e^(−r_f T)                      | ✅                                                      |
| N(x) against scipy values to 1e-12, symmetric, safe in the tails         | ✅                                                      |
| Option-hedge look-ahead guard                                            | ✅ altering data after the pricing date changes nothing |
| Unit tests / engine coverage                                             | 136+ tests, ~99% engine statements                      |
| Playwright                                                               | 12/12 (planner + hedging, mobile + desktop)             |

## Findings (please review)

1. **Realised volatility is low right now.** USD/SGD's 60-day realised volatility from the blended mid rates is about 1.8% (calm period; a typical recent year is 3–4%). Weekend rows aren't the cause (1.78% with, 1.77% without). Blended mid rates may also be smoother than traded rates. So premiums look cheap compared with a real implied-volatility quote. The UI labels it "realised volatility (proxy for implied)" and the override is there.
2. **Positive theta for in-the-money calls** is correct here: with USD rates above SGD rates, a deep in-the-money call gains value as time passes.
3. Vega and theta are shown for the user's whole amount in S$ (per-unit theta rounds to zero). Delta and gamma stay per unit.
4. The "today" forward uses the scenario's start date, capped at the last available FX date.

## Fixes after review

- Realised volatility now uses trading days only, × √252 (see Phase 2). The blended feed is still smoother than a single fixing; see the note in the review summary.
- The payoff chart's "today" label was clipped at the top; the chart now has room for it (e2e test checks it sits inside the chart).
- The header tabs no longer prefetch: their URL changes with every edit, which caused a route-tree request per URL update.
- Vega and theta in S$ keep cents (they're often below S$1); every other SGD figure is whole dollars.
