# Screenshot loop: the editorial redesign

Every round renders the real static build with Playwright at 390×844 (phone, 2× pixels) and 1366×768 (laptop), light and dark. Pages: the Planner, Hedging and How it works. The scenario is fixed: `?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2`. Names follow `{planner|hedging|how}-{phone|laptop}-{light|dark}.jpg`; each image is the first screen.

| Folder             | State                                                         |
| ------------------ | ------------------------------------------------------------- |
| `0-before/`        | Direction A (PR #7), the starting point: no How it works page |
| `1-first-build/`   | First render of the new system                                |
| `2-after-round-1/` | After round 1's fixes                                         |
| `3-final/`         | After round 2's fixes and the performance pass                |
| `states/`          | Interaction states of the final build (see below)             |

Full-page captures of the final build are in `../final/`. In full-page phone captures, the fixed bottom tab bar appears part-way down the page; that's an artefact of stitching, not the layout.

## Round 1: `1-first-build` → `2-after-round-1`

What was off:

- **Metric 3 of the result** read "S$0.00 lower worst-case cost than waiting". Target rate falls back to waiting, so their worst cases are equal; comparing with a different strategy than the other two figures also risked a flattering comparison. All three figures now compare the same pair. A gap that rounds to nothing reads "Same".
- **The amount field** clipped "15000": its width ignored the padding.
- **Phone:** the question, a four-line lede and the converter filled the first screen, so the answer started below it. The phone display size went from 40 to 36px and the lede was cut to one sentence; the answer headline now starts on the first screen.
- **How it works:** "How the replay works" had a subsection with the same title. The section is now "The method".
- **Recharts legends** coloured their text in the series colour, against the rule that text stays in ink. They are now muted ink beside a coloured marker.

## Round 2: `2-after-round-1` → `3-final`

What was off:

- **Lighthouse mobile:** Planner and Hedging scored 86–87 with first paint at 1.5s. The cause was the serif: Newsreader with its optical-size axis is a 129 KB file on the critical path for the headline. One static weight of it is a fraction of that. Preloaded, it brought first paint to 0.8s and the scores to 92–93 (Planner), 92 (Hedging) and 98 (How it works).
- **Phone:** the timeline reserved 368px for a 320px block. Its placeholder heights are now measured: 320px on phones, 336px from 640px.
- **Layout shift (0.005):**
  - The "Converting it all today" row was 6px taller while loading, because the empty skeleton block sat on a different baseline from the figure. The placeholder now has invisible text of the same shape.
  - On phones, "Checking 6,922 comparable past periods…" wraps to two lines where "Loading the rate history…" fits on one, so the line grew mid-load. Two lines are now reserved.
  - The progress dot animated `left`, which the browser counts as layout movement every frame. It now animates `transform`.
- **Converter and result:** their resting heights at 360, 390, 412, 700, 1024, 1366 and 1600px were measured and set as the loading placeholders' minimums, so the planner doesn't move when it loads.
- **Dark mode:** the date field's calendar icon had vanished. The browser already lightens it, and an extra invert filter darkened it again; the filter is gone.

## `states/`

- `timeline-hover-*`: the spot cursor, with the tooltip giving each strategy's cost for the period under the pointer and the difference behind the headline.
- `timeline-legend-*`: hovering a legend item dims the other strategies.
- `evidence-hover-*`: hovering a chart row dims the others and spells the row out in words underneath.
- `currency-search`: "korea" finds KRW.
- `more-options`: the disclosure open.
- `progress-*`: the progress state ("Checking 6,922 comparable past periods…"). The number is counted from the data before the replay runs.
- `phone-timeline`: the timeline on a phone, with the summary bar pinned to the top.
