# Round D: UI/UX refinement

- [`plan.md`](plan.md): the Phase 1 audit, ranked problems, risks and the approved decisions.
- `before/`: production at `29dc164` (1 Nov 2026), at 375×812 (2× pixels, touch) and 1440×900, light and dark.
- `after/`: the same states and filenames on this branch, at the end of Phase 6.
- [`compare.md`](compare.md): before and after, side by side, phase by phase.

Both sets come from [`scripts/design-shots.ts`](../../../scripts/design-shots.ts):

```bash
node scripts/design-shots.ts https://spotcheck-fx.pages.dev docs/design/round-d/before
```

## Sizes kept out of git

The script also captures 430×932 (2×, touch), 768×1024 (touch) and 1920×1080 in both themes. Those files go to `local/before/` and `local/after/`, which are git-ignored to keep the repo small. They were reviewed for the audit and are re-captured at every phase, but they live only on the machine that took them.

## States

Every state is captured at every size in both themes, as `{state}-{width}-{theme}.jpg`.

| State                                               | What it shows                                                  |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `planner-top`                                       | The first screen, with the phone bars                          |
| `planner-comparison`                                | The range chart, the table and the plain-words summary         |
| `planner-plain-words`                               | The plain-words summary alone                                  |
| `planner-timeline`                                  | Every past period, before the period detail                    |
| `planner-period`                                    | The selected period: its chart and conversions                 |
| `planner-strategies`                                | The four strategies in plain terms                             |
| `hedging-top`                                       | Hedging's first screen                                         |
| `hedging-forward`, `-option`, `-greeks`, `-history` | Each Hedging section                                           |
| `how-top`, `how-strategies`, `how-data`             | How it works: the opening, the strategies and the data section |
| `404`                                               | The not-found page                                             |
| `picker-open`, `picker-empty`                       | The currency picker, and a search that matches nothing ("zzz") |
| `state-invalid`                                     | The amount "1.500,50", which the parser rejects                |
| `state-data-error`                                  | The FX file blocked, so the data-error message shows           |
| `state-loading`                                     | Every data file held, so the page stays in its loading state   |
