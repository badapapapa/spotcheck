# Final review round of PR #8

Nineteen fixes from a review on desktop, at 375px and on a real iPhone. `before-375/` is the branch as reviewed: the Cloudflare preview at commit `bca8ee5`, captured at 375×812 (2× pixels) in light and dark. `after-375/` is the same states on the fixed build. `final/` is the usual 390×844 and 1366×768 set for all three pages, light and dark. Full pages are in `../final/`.

| File                   | Shows                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `375-planner-top-*`    | The header disclaimer on a phone (5); the converter without empty space (19)                                         |
| `375-timeline-*`       | The taller timeline with an axis fitted to the data (8)                                                              |
| `375-period-*`         | The period chart after a tap, with the readout (6), and conversions one per line (9)                                 |
| `375-comparison-*`     | "S$19,284 (fixed)" (14) and whole-dollar differences (12)                                                            |
| `375-hedging-top-*`    | The carry reason under the headline (3) and Hedging's own More options (10)                                          |
| `375-payoff-readout-*` | A tap on the payoff chart: the readout instead of a sticky tooltip (6), round ticks and the option's own colour (15) |

## The fixes

| #   | Before                                                                                             | After                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "A hedge narrows the range of outcomes; it doesn't make the average cheaper."                      | "A forward fixes your rate today; an option caps it for an upfront premium. The figures above show how each changed the range of outcomes in this history."                                                             |
| 2   | Pairwise sentences ("spreading over 6 conversions had a most expensive case … lower than waiting") | One template per strategy, in the fixed order, against all at once only: median vs all at once, middle 90%, worst case, % of windows cheaper. The target's hit rate is the one extra clause.                            |
| 3   | The forward headline without a reason                                                              | "That's because USD interest rates are higher than SGD rates. That gap is carry, not a forecast.", directly under it in the same style                                                                                  |
| 4   | "A real quote differs, and it is only available for USD so far."                                   | "A real quote differs. The Hedging page covers USD only for now."                                                                                                                                                       |
| 5   | "Historical data, not advice" hidden below 1024px                                                  | Shown at every width (13px on phones); e2e checks it at 375px on all three pages                                                                                                                                        |
| 6   | Recharts tooltips stuck open after a tap, covering the chart                                       | On touch screens: no floating box; a readout row under the payoff, Greek and period charts shows the tapped values. Payoff chart 288px tall on phones.                                                                  |
| 7   | "Earlier month" went from 28 Jan to 15 Dec (bucket to bucket)                                      | "One month earlier/later" moves to the same calendar day, or the nearest trading day (28 Jan → 29 Dec, since 28 Dec was a Sunday); unit-tested                                                                          |
| 8   | A short phone timeline with a S$16k–S$24k axis                                                     | 280px on phones (300px on laptops); the axis fits the data with a 5% margin (S$17k–S$22k)                                                                                                                               |
| 9   | All of Equal tranches' conversions in one run-on cell                                              | One line each: "14 Jan 2026 · 1.2880"                                                                                                                                                                                   |
| 10  | Hedging's More options showed conversions and target                                               | Only what Hedging uses: start date and spread                                                                                                                                                                           |
| 11  | "2.0%"                                                                                             | "2%" everywhere a setting is shown                                                                                                                                                                                      |
| 12  | "−S$84.95", "within S$84.95" next to whole-dollar costs                                            | One precision per scenario: whole dollars (e.g. "−S$85") unless the scenario costs under S$100 (then cents throughout). Rates, pips, the premium and Greeks keep decimals.                                              |
| 13  | "Today's mid rate"                                                                                 | "Latest mid rate". The data is not stale: the branch contains every main commit. The ECB publishes around 16:00 CET and the fetch runs at 03:00 UTC the next morning, so the latest rate is the previous working day's. |
| 14  | "S$19,284–S$19,284"                                                                                | "S$19,284 (fixed)"                                                                                                                                                                                                      |
| 15  | " : " in tooltips; ticks 1.0894/1.1855/…; the option in Equal tranches' orange                     | ": "; ticks 1.10, 1.20, 1.30, 1.40; the call option in its own validated bronze. Unhedged keeps Wait until deadline's teal and Forward keeps All at once's blue on purpose (DESIGN.md §2).                              |
| 16  | No explanation of a positive theta                                                                 | The theta tip explains why it can be positive; a unit test pins +S$0.02/day at the money, about +S$1.6/day in the money, and negative when the carry reverses                                                           |
| 17  | `/hedging` was a 404; the 404 reused the homepage title                                            | `public/_redirects`: `/hedging` → `/advanced` (301), and `/advanced` itself is untouched. The 404 page's title is "Page not found \| SpotCheck".                                                                        |
| 18  | "SORA from July 2005" with windows from 3 Apr 2006, unexplained                                    | Adds that each window's forward uses SORA compounded over the window's length before it starts, so the first window begins one window-length after SORA does                                                            |
| 19  | Empty space under More options on a 375px phone                                                    | The converter's minimum height now matches its content at 375px (281px); only phones under 370px reserve the taller height                                                                                              |

## Checks on the final build

- `npm run check`: 356 unit tests; data valid.
- Playwright: 79 passed. That covers desktop, the Pixel 7 project and a new 375px touch suite (disclaimer, touch readouts, month step, timeline height, conversions per line).
- axe-core: 0 violations at 390×844 and 1366×768, light and dark, on all three pages.
- Parity with the live site, same data: identical for USD, JPY and EUR. That is 42 planner figures each, plus all 13 Hedging values for USD.
- Lighthouse mobile: Planner 97, Hedging 91–92, How it works 98. Accessibility 100 and CLS 0 on every run.
- Throttled trace (412px, slow 4G, 4× CPU): no layout shifts on any page, How it works included.

## Follow-up: controls hidden behind the phone bars

CI failed on `acdbd5f`: the new 375px test could not click "One month earlier". The button had been scrolled to the bottom edge of the screen, the way focus and Playwright scroll a control into view, and the fixed tab bar covered it. Phone users moving focus with a keyboard or switch control would hit the same problem (WCAG 2.4.11, focus not obscured).

The fix:

- `scroll-padding-top: 64px` on `html` below 1024px, clearing the 56px sticky summary bar.
- `scroll-padding-bottom: 72px + the safe area`, clearing the 56px tab bar.
- The footer's bottom padding matches the tab bar, so the page's last line clears it too.

A new test scrolls the timeline step buttons and Download Excel to the top and bottom edges and checks that nothing covers them. It also checks that the footer's last link clears the tab bar. Without the padding, all three buttons were covered at the bottom edge; with it, all are clear.
