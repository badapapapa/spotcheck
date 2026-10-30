# Numbers parity: main vs the redesign

The redesign changes no calculation, so every figure must match the current
site exactly. It was checked twice, with the same script and scenarios:

1. **Local builds:** a static build of `main` at `48f790c` (built in a
   separate worktree) against this branch, both on the same committed data
   (`diff -r data/` shows no differences).
2. **Deployed sites:** the live site, https://spotcheck-7qb.pages.dev (built
   from `main`), against this branch's Cloudflare preview,
   https://redesign-a.spotcheck-7qb.pages.dev. Both show "Rates up to
   29 Oct 2026".

Both comparisons came out identical.

`parity.json` holds the result for three scenarios:

| Scenario                                                        | Planner   | Hedging                                                                                    |
| --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| USD 15,000 by 1 Aug 2027, 6 conversions, 0.5% spread, 2% target | identical | identical: spot, forward, points, both rates, premium (unit, total, %), worst case, Greeks |
| JPY 500,000 by 1 Mar 2027, 4 conversions, 1% spread, 3% target  | identical | not applicable (USD only)                                                                  |
| EUR 8,000 by 1 Jun 2027, 3 conversions, 0.75% spread, 2% target | identical | not applicable (USD only)                                                                  |

"Planner" compares, as text:

- every strategy's median, 5th and 95th percentile (from the chart rows' labels);
- the whole plain-English summary;
- the selected window's conversion table.

"Hedging" compares:

- every label/value row;
- the historical range chart's rows;
- the historical summary sentence.

In the USD scenario the premium is 0.006097 SGD per unit and S$91.46 for
15,000 USD on both builds.

The headline "Converting today" figure (S$19,284) is new. A unit test checks
it equals the "All at once" median for all 40 currencies at three amounts and
spreads (`lib/__tests__/today-cost.test.ts`). An e2e test checks the rendered
page (`today's cost matches the All at once result`).

`parity-planner.jpg` and `parity-hedging.jpg` show the two builds side by
side, full page, at 1366px.
