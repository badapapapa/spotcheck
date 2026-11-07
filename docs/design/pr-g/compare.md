# PR G: before and after

`before/` is `main` at `edfa8fd`, built locally; `after/` is this branch on the same data commit, with the same filenames, at 375×812 and 1440×900 in both themes. The pairs below are the states that changed. Every state is in both folders.

## F07: privacy, said precisely

What was checked on `main` first:

- no cookies;
- nothing in localStorage, sessionStorage or IndexedDB;
- the only outside host is Cloudflare Web Analytics, whose beacon sends the page's path and never the query with the scenario (checked across every beacon in a session);
- referrer policy `strict-origin-when-cross-origin`.

| Before                            | After                            |
| --------------------------------- | -------------------------------- |
| ![](before/g-about-375-light.jpg) | ![](after/g-about-375-light.jpg) |
| ![](before/g-about-1440-dark.jpg) | ![](after/g-about-1440-dark.jpg) |

The note under Copy link, and the error screens' "Nothing was saved.", are in the glance pairs below. The page-level error screen has no screenshot, because nothing can trigger it on demand.

## F08: Hedging is USD only

The nav reads "Hedging (USD)". With another currency, Switch to USD says what it prices and keeps the plan for the planner.

| Before                                     | After                                     |
| ------------------------------------------ | ----------------------------------------- |
| ![](before/g-hedging-jpy-375-light.jpg)    | ![](after/g-hedging-jpy-375-light.jpg)    |
| ![](before/g-hedging-notice-375-light.jpg) | ![](after/g-hedging-notice-375-light.jpg) |
| ![](before/g-hedging-notice-1440-dark.jpg) | ![](after/g-hedging-notice-1440-dark.jpg) |
| ![](before/planner-top-1440-light.jpg)     | ![](after/planner-top-1440-light.jpg)     |

## F06: start dates shown, above the chart

| Before                                     | After                                     |
| ------------------------------------------ | ----------------------------------------- |
| ![](before/g-timeline-1y-375-light.jpg)    | ![](after/g-timeline-1y-375-light.jpg)    |
| ![](before/g-timeline-1y-1440-light.jpg)   | ![](after/g-timeline-1y-1440-light.jpg)   |
| ![](before/planner-timeline-1440-dark.jpg) | ![](after/planner-timeline-1440-dark.jpg) |

## F09 and F05: the glance

When results aren't current, the glance names the whole last valid entry, and Copy link reads "Copy link to that entry". On phones, "Explore past periods" jumps to the timeline. The note on what the link includes sits under the buttons.

| Before                                     | After                                     |
| ------------------------------------------ | ----------------------------------------- |
| ![](before/g-invalid-glance-375-light.jpg) | ![](after/g-invalid-glance-375-light.jpg) |
| ![](before/g-invalid-glance-1440-dark.jpg) | ![](after/g-invalid-glance-1440-dark.jpg) |
| ![](before/g-glance-375-dark.jpg)          | ![](after/g-glance-375-dark.jpg)          |
| ![](before/g-glance-1440-light.jpg)        | ![](after/g-glance-1440-light.jpg)        |

## F03: weekend and holiday dates

In this period, two tranches were scheduled for Sat 21 Mar and Sun 17 May 2026.

| Before                             | After                             |
| ---------------------------------- | --------------------------------- |
| ![](before/g-period-375-light.jpg) | ![](after/g-period-375-light.jpg) |
| ![](before/g-period-1440-dark.jpg) | ![](after/g-period-1440-dark.jpg) |

## Range chart and comparison blocks at EUR 1e12

On phones, the axis ticks are compact (S$1T) and each median sits under its name. In the comparison blocks, labels no longer break letter by letter ("Medi / an"). At normal amounts nothing changes; see `planner-comparison-*`.

| Before                                       | After                                       |
| -------------------------------------------- | ------------------------------------------- |
| ![](before/g-huge-comparison-375-light.jpg)  | ![](after/g-huge-comparison-375-light.jpg)  |
| ![](before/g-huge-comparison-1440-light.jpg) | ![](after/g-huge-comparison-1440-light.jpg) |
| ![](before/planner-comparison-375-light.jpg) | ![](after/planner-comparison-375-light.jpg) |

## Checks

| Check                             | Result                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                   | 571 tests passed                                                                                                                                                                     |
| Playwright                        | 709 passed, 111 skipped by project, 0 failed                                                                                                                                         |
| New tests against `main`'s build  | 20 of 27 fail. The 7 that pass guard behaviour that was already right: storing nothing, a bad `from` ignored, the range chart at normal amounts, and the F05 link hidden on desktop. |
| axe (WCAG A/AA)                   | 0 violations: Planner, Planner at 1Y, Hedging, Hedging with JPY, How it works, 404, BND, EUR 1e12; at 375 and 1366; both themes                                                      |
| Parity against `main` (same data) | 0 differences in 146 checks: 5 currencies, each at All/1Y/5Y/10Y, plus USD Hedging. The new "(scheduled …)" labels are set aside; every figure is identical.                         |

Lighthouse 12.8.2 (mobile, 3 runs per page, local builds) scored 100 for accessibility, best practices and SEO, with CLS 0, on all 18 runs.

| Page         | Branch performance | `main` performance |
| ------------ | ------------------ | ------------------ |
| Planner      | 95 / 95 / 95       | 95 / 95 / 95       |
| Hedging      | 98 / 94 / 98       | 95 / 95 / 95       |
| How it works | 99 / 96 / 96       | 96 / 99 / 96       |
