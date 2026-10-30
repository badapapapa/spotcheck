# Audit before the editorial redesign (31 Oct 2026)

What the product does today, and what is wrong with how it is presented. This is the starting point for `DESIGN.md`.

## Functionality to preserve

**Planner (`/`):**

- **Scenario:** amount, currency (40 currencies), deadline, start date, number of conversions, spread and target. It lives entirely in the URL, is debounced into `history.replaceState` and survives back and forward.
- **Currency switching:** a user's switch converts the amount to keep its SGD value; a shared link's amount is never converted.
- **Today's cost:** amount × latest rate × (1 + spread), equal to the All at once result (tested for every currency).
- **The replay:** four strategies over every past window of the same length since 1999, run in a Web Worker. The output is the median, the 5th–95th percentiles, the min and max, each strategy's share cheaper than All at once, the target hit rate, the window count and the count of independent histories.
- **The plain-English summary** of the replay (`lib/summary.ts`).
- **One window in detail:** the rate path, each strategy's conversion dates, and its actual SGD cost at the time. It exports to `.xlsx` with live formulas, and ExcelJS loads only on click.
- **Copy link.**
- **Per-currency source labels** (ECB cross, ECB direct, Frankfurter blended, BND peg) and the BND peg notice.
- **Methodology:** six topics.

**Hedging (`/advanced`):**

- the forward (spot, forward, points, SORA and fed-funds rates);
- the Garman-Kohlhagen call with the strike slider, volatility override and lookback;
- the payoff chart and the Greeks with their charts;
- the historical replay of unhedged against forward against option;
- the USD-only notice.

**Everywhere:**

- the disclaimer on every page;
- the attribution;
- no cookies, accounts or third-party requests, and the CSP;
- the advisory-wording guard;
- 48 Playwright checks and 295 unit tests.

## Presentation problems (Direction A, PR #7)

1. **No answer.** The page shows a converter and then a chart. The user's question, "when should I exchange?", is never answered in words at the top. The answer has to be read off a range chart.
2. **Mechanism first.** The subtitle describes the method ("Replays four ways of converting…") rather than the question it answers.
3. **Everything is a panel.** The converter, the results, the forward panel, the option panel, the Greeks and the hedge history are all rounded bordered boxes of equal weight. There is no rhythm: every section has the same width, padding and shape.
4. **Generic palette and type.** Navy with a bright blue primary and a geometric sans reads as a standard fintech or SaaS template. Nothing in the identity is specific to SpotCheck.
5. **The exploration is weak.** "Look at one window" is a bare range slider. Nothing shows how outcomes moved across history, so there is no reason to explore.
6. **Methodology is buried** in an accordion at the bottom of the planner. The trust signals (27 years of data, about 7,000 periods tested, the sources, the last update) aren't surfaced where the result is.
7. **Strategies are never explained** in plain terms beyond their names; the explanation hides in the summary paragraph.
8. **The desktop converter column is mostly empty** below the converter, and the two columns are unbalanced.
9. **Charts are library defaults:** Recharts legends, tooltips and axes are styled one by one, there is no cross-chart hover language, and the strategy colours aren't tied to the rest of the page.
10. **The navigation** has no home for "how it works", so trust content has nowhere to live.

## Accessibility and responsive state (keep as a floor)

- axe-core reports 0 violations in light and dark.
- Tap targets are at least 44px and focus rings are visible.
- CLS is 0.
- Lighthouse mobile scores 90–92 for performance and 100 for accessibility.

The redesign must not go below any of these.
