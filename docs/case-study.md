# SpotCheck: a case study (draft)

## The problem

Every semester, thousands of NUS, NTU and SMU students go on exchange and need a known amount of foreign currency by a known date. The question they ask each other in Telegram groups is always the same: _convert now, spread it out, or wait?_ Most answers are anecdotes about one lucky or unlucky month.

SpotCheck answers a better question: _how would each of those approaches have played out across every comparable period in the last 27 years?_ It shows the trade-off (a lower average versus a narrower range of outcomes) without telling anyone what to do.

## What I built

- A **planner** that replays four strategies over ~10,000 historical windows for any of 40 currencies, with a distribution chart, a generated summary and a window-by-window explorer.
- A **hedging tab** that prices forwards (covered interest parity) and options (Garman-Kohlhagen) for the same scenario, with live Greeks, and compares hedged and unhedged outcomes historically.
- A **data pipeline** that keeps 40 FX series, daily SORA and the US fed funds rate up to date with a daily GitHub Actions job, validated before every commit.

The site is static (no server, no accounts, no cookies) and costs nothing to run.

## The maths, and the decisions behind it

**Comparing windows fairly.** A naive replay mixes rate _levels_ across decades: a window starting in 1999 at 1.70 SGD/USD always looks expensive next to one in 2024 at 1.34. I normalise each window by its own starting spot and rescale to today's. Every outcome then means "if the next months move like that window did". One consequence: converting everything at once has no range at all, because today's rate is known. It is also a clear way to explain what spreading conversions buys: a narrower range, not a lower cost.

**Look-ahead bias.** Every decision on day _d_ may only use data up to _d_. The engine makes this structural: `rateAsOf` (on or before) for decisions and `rateOn` (next available) for trades. Option volatility comes from the observations strictly before the pricing date, and the forward's rates from the window ending on it. Tests alter every value after _d_ and assert that nothing decided by _d_ changes.

**Overlapping windows.** 10,000 windows that start a day apart are not 10,000 independent experiments. The summary says how many non-overlapping windows the history really contains (about 35 for a 9-month plan), and the methodology says the percentages describe one history, not probabilities.

## The SORA back-check

The plan was to compound daily SORA myself (MAS's published compounded rates only start in 2020), then check against MAS. The first attempt, compounding over the window ending on the SORA _value_ date, was off by up to 22 bp. Testing conventions against all published values showed MAS's compounded rate on publication date _P_ covers **[P − tenor, P)**. With that convention the engine reproduces every published 1M, 3M and 6M value since August 2020 within 0.0101 bp, the rounding of MAS's four-decimal figures. That convention also settles look-ahead for the forward proxy: on day _d_ it uses SORA through _d − 1_, which MAS publishes on the morning of _d_.

## Testing approach

- Engine first, UI second: the engine had 90+ tests and a 90% coverage gate before any page existed.
- An **independent Python notebook** (numpy, scipy) reimplements compounding, the strategies and GK pricing from the formulas, not from my code, and writes fixtures the TypeScript must match. It caught a bug, in the _notebook_: my first Python draft compounded each calendar day separately instead of applying a weekend rate once as simple interest. The TS engine was already right, since it matched MAS. An independent check is only useful if you're prepared for either side to be wrong.
- Property tests for pricing (put-call parity, monotonicity, delta bounds, Greeks vs finite differences) and a textbook reference value.
- The Excel export's formulas were recalculated by an independent formula engine after changing the inputs, to show they are live and match the engine.
- Playwright smoke tests on mobile and desktop; Lighthouse mobile scores 94–96 for performance and 100 for accessibility.

## Performance

The replay is about 80 ms on a laptop but became a 1.3-second main-thread task on Lighthouse's throttled phone for the hedging tab. Moving both replays to a Web Worker, rendering the intro as static HTML, and removing layout shifts (a nav that appeared after hydration, a hint that appeared after data loaded) took the mobile score from 32–43 to 94–96.

## What I'd do next

- Implied volatility, if a free source appears; realised volatility from blended mid rates understates what a bank would charge.
- Forward-looking term rates (e.g. SGS T-bills) in place of backward-compounded overnight rates.
- Interest-rate data for more currencies, so the hedging tab isn't USD-only.
- Real user numbers from the first exchange cohort, and changes driven by their feedback.

_Add: number of users, feedback quotes, and the launch link once live._
