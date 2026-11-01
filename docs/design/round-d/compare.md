# Round D: before and after

`before/` is production at `29dc164`; `after/` is this branch, on the same data, with the same filenames. Both sets are 375×812 (2× pixels, touch) and 1440×900, light and dark. The other sizes are in the git-ignored `local/` folder (see the [README](README.md)).

This page covers Phases 2–4, up to the extra gate after the timeline. Hedging and How it works (Phase 5) and motion and mobile polish (Phase 6) follow.

## Phase 2: one system

- **Payoff legend:** it was Recharts' centred legend; now it is the shared one, left-aligned, in the hedge order of the history table.
- **Volatility lookback:** the select is styled as a field.
- **Copy link:** a secondary button.
- **Type:** one scale throughout.

| Before                                     | After                                     |
| ------------------------------------------ | ----------------------------------------- |
| ![](before/hedging-option-375-light.jpg)   | ![](after/hedging-option-375-light.jpg)   |
| ![](before/hedging-forward-1440-light.jpg) | ![](after/hedging-forward-1440-light.jpg) |

## Phase 3: the Planner

- **First screen (problem 1):**
  - At 375×812 the glance heading and first row are above the tab bar; before, the first figure was under it.
  - At 430×932 all four medians are visible.
- **Deadline:**
  - It is written out under the field ("1 Sep 2027, 10 months from 1 Nov 2026").
  - I shipped the fallback (text next to the field), not an overlay; see the report for why.
- **Plain labels:**
  - "at mid rate (i) before your 0.5% fee";
  - the key under the glance;
  - "SGD per USD: lower = cheaper for you";
  - "convert in equal parts".
- **Stale results:** invalid input keeps the last results in place, muted, and says whose they are.

| Before                                  | After                                  |
| --------------------------------------- | -------------------------------------- |
| ![](before/planner-top-375-light.jpg)   | ![](after/planner-top-375-light.jpg)   |
| ![](before/planner-top-1440-dark.jpg)   | ![](after/planner-top-1440-dark.jpg)   |
| ![](before/state-invalid-375-light.jpg) | ![](after/state-invalid-375-light.jpg) |

**Currency picker:**

- the flags are gone;
- an empty search explains itself (before: a bare "Matches" heading);
- the selected option has the check.

| Before                                 | After                                 |
| -------------------------------------- | ------------------------------------- |
| ![](before/picker-open-375-dark.jpg)   | ![](after/picker-open-375-dark.jpg)   |
| ![](before/picker-empty-375-light.jpg) | ![](after/picker-empty-375-light.jpg) |

**Comparison:**

- **One word per idea:** "past periods" and "Most expensive past period".
- **Laptops:** the empty right column holds the reading notes, the trend note (computed from the data) and the context line linked to How it works.
- **Phones:** the plain words fold, about 460px shorter at 375.

| Before                                        | After                                        |
| --------------------------------------------- | -------------------------------------------- |
| ![](before/planner-comparison-1440-light.jpg) | ![](after/planner-comparison-1440-light.jpg) |
| ![](before/planner-comparison-375-dark.jpg)   | ![](after/planner-comparison-375-dark.jpg)   |
| ![](before/planner-strategies-1440-light.jpg) | ![](after/planner-strategies-1440-light.jpg) |

## Phase 4: the timeline and the period

- **One control:**
  - The chart is the slider: arrows a day, Page Up/Down a month, Home/End the ends.
  - Drag or tap scrubs it, and the detail follows.
  - The separate period slider is gone.
- **One marker:** the spot motif, with a dot on each line, kept off the plot's edge.
- **Readout:** the legend is the readout, with each strategy's name and its cost for the marked period, so nothing floats over the lines.
- **Legend:** a click locks a strategy; "Show all strategies" or Esc unlocks it.
- **Phones:**
  - the month buttons sit side by side;
  - the axis has more year labels;
  - the chart's height fits between the fixed bars (a landscape phone included).

| Before                                      | After                                      |
| ------------------------------------------- | ------------------------------------------ |
| ![](before/planner-timeline-1440-light.jpg) | ![](after/planner-timeline-1440-light.jpg) |
| ![](before/planner-timeline-375-light.jpg)  | ![](after/planner-timeline-375-light.jpg)  |
| ![](before/planner-timeline-375-dark.jpg)   | ![](after/planner-timeline-375-dark.jpg)   |

**Period detail:**

- **Markers:** where two strategies convert on the same day their markers sit side by side (All at once was hidden under Equal tranches, Wait under Target rate).
- **Costs:** "Cost then" plus the cost at today's rate, which matches the timeline's readout.
- **Phones:** each strategy's conversions stack under its name, date and rate in two columns.

| Before                                   | After                                   |
| ---------------------------------------- | --------------------------------------- |
| ![](before/planner-period-1440-dark.jpg) | ![](after/planner-period-1440-dark.jpg) |
| ![](before/planner-period-375-light.jpg) | ![](after/planner-period-375-light.jpg) |
