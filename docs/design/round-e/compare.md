# Round E: before and after

`before/` is `main` at `f739e25` (the Round D merge, as in production); `after/` is this branch, on the same data, with the same filenames. Both sets are 375×812 (2× pixels, touch) and 1440×900, light and dark. Every state in both themes is in the folders; the pairs below are the ones that changed.

## 1. Pay SGD, need the selected currency

"You pay `SGD` → you need `USD`" sits at the top of the converter, on Planner and Hedging. The second code follows the currency picker. The arrow is an icon, not a control.

| Before                                 | After                                 |
| -------------------------------------- | ------------------------------------- |
| ![](before/planner-top-375-light.jpg)  | ![](after/planner-top-375-light.jpg)  |
| ![](before/planner-top-375-dark.jpg)   | ![](after/planner-top-375-dark.jpg)   |
| ![](before/planner-top-1440-light.jpg) | ![](after/planner-top-1440-light.jpg) |
| ![](before/planner-top-1440-dark.jpg)  | ![](after/planner-top-1440-dark.jpg)  |
| ![](before/hedging-top-375-light.jpg)  | ![](after/hedging-top-375-light.jpg)  |
| ![](before/hedging-top-375-dark.jpg)   | ![](after/hedging-top-375-dark.jpg)   |
| ![](before/hedging-top-1440-light.jpg) | ![](after/hedging-top-1440-light.jpg) |
| ![](before/hedging-top-1440-dark.jpg)  | ![](after/hedging-top-1440-dark.jpg)  |

The line costs height, and on phones it pushed the first result row under the tab bar. Tighter phone spacing above and inside the converter wins that back, and a new e2e test holds it.

| Bottom of the result rows | Tab bar top | Before | After |
| ------------------------- | ----------- | ------ | ----- |
| 375×812, first row        | 756px       | 739px  | 743px |
| 430×932, fourth row       | 876px       | 870px  | 874px |

## 2. Timeline range: 1Y / 5Y / 10Y / All

All is the default and draws the same chart as before, with the buttons above it.

| Before                                      | After                                      |
| ------------------------------------------- | ------------------------------------------ |
| ![](before/planner-timeline-375-light.jpg)  | ![](after/planner-timeline-375-light.jpg)  |
| ![](before/planner-timeline-375-dark.jpg)   | ![](after/planner-timeline-375-dark.jpg)   |
| ![](before/planner-timeline-1440-light.jpg) | ![](after/planner-timeline-1440-light.jpg) |
| ![](before/planner-timeline-1440-dark.jpg)  | ![](after/planner-timeline-1440-dark.jpg)  |

The shorter ranges are new, so they have no before. The axis refits to the visible periods and a note says the results still use every period. On phones, 1Y draws daily periods and 5Y keeps the monthly bands.

| 1Y                                            | 5Y                                            |
| --------------------------------------------- | --------------------------------------------- |
| ![](after/planner-timeline-1y-375-light.jpg)  | ![](after/planner-timeline-5y-375-light.jpg)  |
| ![](after/planner-timeline-1y-375-dark.jpg)   | ![](after/planner-timeline-5y-375-dark.jpg)   |
| ![](after/planner-timeline-1y-1440-light.jpg) | ![](after/planner-timeline-5y-1440-light.jpg) |
| ![](after/planner-timeline-1y-1440-dark.jpg)  | ![](after/planner-timeline-5y-1440-dark.jpg)  |

## 3. Target label

"Target: % below the starting rate" is now "Rate you'd wait for (target)". The unit moved to the help line under the field.

| Before                                     | After                                     |
| ------------------------------------------ | ----------------------------------------- |
| ![](before/planner-options-375-light.jpg)  | ![](after/planner-options-375-light.jpg)  |
| ![](before/planner-options-375-dark.jpg)   | ![](after/planner-options-375-dark.jpg)   |
| ![](before/planner-options-1440-light.jpg) | ![](after/planner-options-1440-light.jpg) |
| ![](before/planner-options-1440-dark.jpg)  | ![](after/planner-options-1440-dark.jpg)  |

## Checks on the final build

| Check                     | Result                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run check`           | 542 tests passed; type-check, lint and data validation clean                                |
| Playwright                | 586 passed, 62 skipped by project (phone-only or desktop-only), 0 failed                    |
| axe (WCAG A/AA)           | 0 violations: 4 pages, plus the Planner at 1Y, at 375 and 1366, in both themes              |
| Parity against production | 0 differences: USD, JPY, EUR, BRL and VND Planner, each at All, 1Y, 5Y and 10Y; USD Hedging |

Lighthouse 12.8.2, mobile, three runs per page, against the local static build. Accessibility, best practices and SEO were 100 and CLS 0 on all nine runs.

| Page         | Performance, Round D | Performance, Round E | LCP, Round E      | TBT, Round E       |
| ------------ | -------------------- | -------------------- | ----------------- | ------------------ |
| Planner      | 98 / 96 / 96         | 97 / 95 / 95         | 2.2 / 2.8 / 2.8 s | 160 / 100 / 110 ms |
| Hedging      | 96 / 96 / 96         | 94 / 95 / 95         | 2.8 / 2.8 / 2.8 s | 150 / 120 / 110 ms |
| How it works | 96 / 96 / 96         | 99 / 96 / 99         | 2.3 / 2.8 / 2.3 s | 30 / 30 / 30 ms    |
