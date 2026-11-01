# Round E: plan

Three small changes, all display only. The engine, the data, the methodology and every figure stay the same, so parity must stay identical.

Baseline: `before/` is `main` at `f739e25` (the Round D merge, now in production), at 375 and 1440 in both themes. `mockups/` holds the injected sketches referred to below. They are not built code.

## 1. Pay SGD, need the selected currency

**Now:** the converter says "I need [15,000] [USD] by [date]". SGD appears only as "S$" on the Planner's "Converting it all today" row, and not at all in Hedging's converter. Both pages share `ScenarioForm`, so a single change covers both.

**Option A (recommended): a direction line at the top of the converter box.**

> You pay `SGD` → you need `USD`

- The codes sit in neutral pills, with the same rule and sunken fill as the field chips.
- The second code follows the currency picker as you change it.
- The arrow is an icon only, not a control, and there is no swap button.
- The line is the same on Planner and Hedging.
- The "I need … by …" sentence and the rows below it don't change.
- Screen readers hear "You pay SGD, you need USD"; the arrow is `aria-hidden`.
- Cost: one 20px line, so the converter and result minimum heights are re-measured to keep CLS at 0.
- Mockups: `converter-a-planner-*`, `converter-a-hedging-*`.

**Option B: two stacked rows, like a money-transfer converter.**

- "You pay (SGD)" comes first with the all-at-once figure, then a down arrow in a circle, then "You need [15,000] [USD] by [date]".
- It is closer to a transfer app, but it puts a figure you can't type in above the field you type in.
- Hedging has no SGD figure today, so it would need one added.
- The phone layout grows about 90px, which pushes the glance below the fold at 375.
- Mockup: `converter-b-planner-*`.

## 2. Timeline range: 1Y / 5Y / 10Y / All

A button group sits above the "What if you had converted in another period?" chart, between the lede and the "Selected: …" readout. It defaults to **All**.

- **Display only.** The glance, the comparison, the range chart, the period detail and the Excel export still use every period. The selected period is still an index into the full history.
- **What a range covers:** periods whose start falls within 1, 5 or 10 years of the latest period's start. This is the right edge of the chart, not today. For a 10-month plan, 1Y means periods starting 30 Dec 2024 to 30 Dec 2025.
  - A range that is as long as the history or longer is disabled.
  - Every currency today has history from 1999 or 2000, so all four always apply. The guard is for safety.
- **Accessible:** `role="group"` labelled "Range shown on the chart", with `aria-pressed` buttons.
  - Visible text is "1Y" and so on, plus a screen-reader expansion: "1Y (last year)". The accessible name still contains the visible label.
  - Targets are 44px tall on phones, and the group is reached by Tab before the chart.
- **Inside the range:**
  - ←/→ steps a day and is clamped to the visible range.
  - PgUp/PgDn steps a month, also clamped.
  - Home/End go to the first and last visible period.
  - Drag, tap and hover map onto the visible range.
  - Earlier/Later month (phones) are disabled at the visible edges.
  - `aria-valuemin`/`aria-valuemax` and the slider description name the visible range.
- **Year ticks:** about one per 80px, as now. Ranges of two years or less use month ticks ("Jan 2025").
- **Note when not All:** "Showing periods starting 30 Dec 2024 to 30 Dec 2025. The results above and the export use all 6,912 periods." This sits under the chart, with the same style as the monthly-band note.
- **Code:** a pure helper in `lib/` (`visibleRange(startDates, range)` and `clampToRange`) with unit tests. No engine change.
- **Mockup:** `timeline-ranges-*`, showing placement only. The real group will use the site's segmented style, with accent-soft for the pressed button.

## 3. Target label

`Target: % below the starting rate` becomes **Rate you'd wait for (target)**.

- The label loses its unit, so the unit moves into the help line under the field: "% below the starting rate. Used by the Target rate strategy."
- Note: the field has no (i) help tip today, only that help line, which `aria-describedby` already links. I'll keep the help line as the help, not add a new tip.
- The summary chip ("2% target") and the strategy name "Target rate" don't change.

## Tests and checks

- **Unit tests:** range windows, clamping, ranges disabled for short histories, and month ticks.
- **E2E:**
  - the direction line on both pages, and how it follows the picker;
  - the group's semantics and that it defaults to All;
  - each range narrows the axis;
  - keys, scrubbing and the month buttons stay inside the range;
  - the glance, the comparison and the export figures are identical under every range;
  - narrowing moves a selection that falls outside the range;
  - the target label and its help.
- **Existing safeguards:** the advisory wording sweep (30 scenarios) runs over all new copy. No existing test is weakened. `robustness.spec.ts` gets the new label only.
- **At the gate:**
  - `npm run check` and the full Playwright run;
  - axe on 4 pages × 375/1366 × both themes;
  - parity on 5 currencies (Planner and Hedging);
  - Lighthouse, mobile, 3 runs per page;
  - `after/` at 375 and 1440 in both themes, with `compare.md`;
  - the preview URL and its SHA.

## Decisions needed

1. **Converter:** Option A (direction line) or Option B (two stacked rows)? I recommend A.
2. **Selection outside a narrowed range:** move it to the nearest visible period, which updates the period detail? Or keep it, with the marker off-chart and a "Selected period is outside this range" note? I recommend moving it to the nearest visible period.
3. **Y axis:** refit it to the visible range, as stock charts do? Otherwise 1Y draws as a near-flat line on the full-history scale. I recommend refitting.
4. **Phones at 1Y:** draw the daily periods (about 250 points) instead of 12 monthly bands? I recommend daily. 5Y, 10Y and All stay monthly.
5. **Persistence:** the range is view state, like the pinned strategy. It is not in the URL and not in a copied link, and it resets to All on reload. Persist it as a URL parameter instead?
