# Weeks 6–7 · Phase 3: Planner MVP

**Status:** merged into `main` in [`82f1f60`](https://github.com/badapapapa/spotcheck/commit/82f1f60).

## What was built

| Item                                                                                                                                                                                   | Where                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Planner page: form → replay → chart → summary → sample path → methodology                                                                                                              | `app/page.tsx`, `app/components/Planner.tsx`                              |
| Scenario form with defaults (USD 15,000, 6 conversions, 0.5% spread, 2% target), currency picker with flags, live "≈ S$" hint, per-field validation that never resets half-typed input | `app/components/ScenarioForm.tsx`                                         |
| Outcome chart: one row per strategy, 5th–95th bar, median dot, min–max line; hover/focus details; drawn at the container's real width so text stays readable on phones                 | `app/components/DistributionChart.tsx`                                    |
| Table view of the same numbers                                                                                                                                                         | `app/components/OutcomeTable.tsx`                                         |
| Plain-English summary generated from the stats, never advisory (tested)                                                                                                                | `lib/summary.ts`                                                          |
| Sample path: slider over every historical start, rate line with each strategy's conversions (colour + shape), conversions table                                                        | `app/components/SamplePath.tsx`                                           |
| Methodology (replay, rescaling, long trends, overlapping windows, mid vs real rates, limits)                                                                                           | `app/components/Methodology.tsx`                                          |
| Scenario ↔ URL (every field, per-field fallbacks), copy-link button                                                                                                                    | `lib/url-state.ts`, `app/components/CopyLinkButton.tsx`                   |
| Browser data loading with Zod validation; data copied into the static site at build time                                                                                               | `lib/data.ts`, `scripts/copy-data.ts`                                     |
| Footer: attribution and last-updated date from `data/meta.json`                                                                                                                        | `app/layout.tsx`                                                          |
| Validated chart palette (light + dark)                                                                                                                                                 | `app/globals.css`, `lib/strategy-style.ts`                                |
| Playwright smoke tests (mobile + desktop) and a CI job for them                                                                                                                        | `e2e/planner.spec.ts`, `playwright.config.ts`, `.github/workflows/ci.yml` |
| Feedback template for the 5 student sessions                                                                                                                                           | `docs/feedback.md`                                                        |

All 40 currencies already work in the planner (the plan had this in Phase 5), because the data pipeline fetched them all.

## Checks

- `npm run check`: all unit tests pass; engine coverage above 90%.
- `npm run e2e`: 4/4 (planner loads with the chart; scenario round-trips through the URL).
- Replay in the browser: about 80–86 ms for 9,800 USD windows (before the trading-day fix; ~7,000 now) with 12 tranches (desktop, dev build). That's inside the 300 ms budget, so no Web Worker yet (measured with a temporary `performance.measure`, since removed).
- Accessibility: every input labelled; charts have text alternatives, a table view and keyboard focus; strategy identity uses colour, marker shape and labels.

## Decisions (please review)

- **Lump sum has no range.** With the rescaling from Phase 2, converting at once always costs amount × today's rate × (1 + spread). The chart shows it as a single dot, and the summary says why.
- The summary compares tranches with _waiting_ for the worst case (lump sum has no worst case), and with _converting at once_ for the median.
- The sample-path slider starts on the most recent window.
- Native `<select>` and range inputs instead of custom ones, for phone pickers and screen readers.

## Fixes after review

- **URL updates are debounced (300 ms) and use `history.replaceState`.** Typing "4000" used to fire a route request per keystroke (`index.txt?a=4`, `?a=40`, …). State is now local and the URL follows once typing pauses: no route requests, no extra history entries (`lib/use-planner-state.ts`, e2e test that fails on the old code).
- **SGD amounts are whole dollars everywhere** (the summary used to show "S$84.13").
- **Apple touch icon** added (`public/apple-touch-icon.png`, linked in the page metadata).
- Window counts and medians changed with the trading-day fix (Phase 1/2): about 7,000 windows for a 9-month USD plan instead of 9,812.

## [BEN] to do for Gate 3

1. Connect Cloudflare Pages (see the week 1 notes) so there's a live link.
2. Have 5 exchange students try it; fill in `docs/feedback.md`.

## Dependencies added

`recharts` (sample-path chart), `@playwright/test` (dev). shadcn `input`, `label`, `card`, `accordion` components were generated into `components/ui/`.
