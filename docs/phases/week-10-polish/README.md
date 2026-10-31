# Week 10 · Phase 5: Polish and launch

**Status:** merged into `main` in [`2387e0b`](https://github.com/badapapapa/spotcheck/commit/2387e0b). Launch itself waits on the [BEN] steps below.

## What was built

| Item                                                                                                                                                                                                                            | Where                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Excel export of any historical window: Scenario (named inputs), Strategies (live formulas: `MINIFS` for next trade date, `VLOOKUP` rates, `Amount/Tranches`, `×(1+Spread)`, `SUM` totals), Rates (daily data); loaded on demand | `lib/xlsx.ts`, button in `app/components/SamplePath.tsx`                                                          |
| Web Worker for both replays (planner and hedge history); previous result stays on screen while recomputing                                                                                                                      | `lib/compute.worker.ts`, `lib/compute.ts`, `lib/use-data.ts`                                                      |
| Performance and accessibility fixes: static intros (fast LCP), static nav fallback, reserved hint line, `main` min-height (no layout shift), card titles as `h2`, chart text not duplicated for screen readers                  | `app/page.tsx`, `app/advanced/page.tsx`, `app/layout.tsx`, `app/components/SiteNav.tsx`, `components/ui/card.tsx` |
| Test server gzips like Cloudflare does, so local Lighthouse runs are realistic                                                                                                                                                  | `scripts/serve-out.ts`                                                                                            |
| Full README with screenshots, formulas, testing and data attribution                                                                                                                                                            | `README.md`, `docs/images/`                                                                                       |
| Case-study draft                                                                                                                                                                                                                | `docs/case-study.md`                                                                                              |

Already done in earlier phases: all 40 currencies in the planner (Phase 3), option-hedged history (Phase 4).

## Results

| Check                      | Result                                                                                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lighthouse mobile, planner | Performance **96**, accessibility 100, best practices 100, SEO 100                                                                                                                                        |
| Lighthouse mobile, hedging | Performance **94**, accessibility 100, best practices 100, SEO 100                                                                                                                                        |
| Before the fixes           | Performance 43 (planner) / 32 (hedging): 1.35 s main-thread task, LCP 9.7 s, CLS 0.79                                                                                                                     |
| Excel formulas             | Recalculated with an independent engine (Python `formulas`): all totals and the target date match the TS engine; doubling the amount and changing the spread scaled every total by exactly 2 × 1.01/1.005 |
| Unit tests                 | 150 pass; engine coverage ~99%                                                                                                                                                                            |
| Playwright                 | 14/14 incl. the `.xlsx` download                                                                                                                                                                          |

Lighthouse was run locally against the static build (gzip, simulated mobile). After the review fixes it scores 94 / 94 for performance and 100 for the rest on both pages. Re-run it on the live `*.pages.dev` URL after launch.

## Fixes after review

- `exceljs` pins `uuid ^8.3.0`, which `npm audit` flags (`uuid <11.1.1`). An npm `overrides` entry forces `uuid ^11.1.1`; ExcelJS only calls `uuid.v4()`, which v11 still provides, and the Excel unit tests and download e2e test pass. `npm audit --omit=dev`: 0 vulnerabilities.
- `shadcn` moved to devDependencies (Phase 1 branch).
- ExcelJS is loaded only by `await import("exceljs")` inside the download handler; an e2e test checks no script containing ExcelJS is fetched before the click and one is after.
- Windows now start on trading days only (~7,000 for a 9-month USD plan).

## Notes

- If someone edits the tranche count _inside_ the spreadsheet, the number of tranche rows doesn't change (the sheet says so). Amount, spread and target edits recalculate everything.
- Excel's `MINIFS` needs Excel 2019+/365, Google Sheets or LibreOffice.

## [BEN] to do for Gate 5 (launch)

1. Connect Cloudflare Pages (week 1 notes) and enable Web Analytics; put the live link in the README.
2. Collect feedback from 5 students (`docs/feedback.md`).
3. Confirm the employer outside-activity policy check.
4. Decide when to make the repo public; then turn on GitHub secret scanning and push protection.
5. ~~Merge the phases in order~~ Done: all five phases were merged into `main` on 17 Oct 2026 (see the [phase index](../README.md)).

## Dependencies added

`exceljs` (in the plan; loaded only when downloading).
