# Screenshot loop

Every round renders the real static build (`npm run build`, served by
`scripts/serve-out.ts`) with Playwright at 390×844 (phone, 2× pixels) and
1366×768 (laptop), light and dark, for both pages. The scenario is fixed:
`?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2`. Each round was compared
against DESIGN.md and the reference sites (for density, pacing and type only;
the reference screenshots are not in the repo).

Each folder is one state of the build. A round's "before" is the folder
above it and its "after" is the folder below it:

| Folder             | State                                         |
| ------------------ | --------------------------------------------- |
| `1-first-build/`   | First render of Direction A                   |
| `2-after-round-1/` | After round 1's fixes                         |
| `3-after-round-2/` | After round 2's fixes                         |
| `4-final/`         | After round 3 (performance and accessibility) |

File names: `{planner|hedging}-{phone|laptop}-{light|dark}.jpg` (the visible
viewport, i.e. what is above the fold). Full-page captures of Direction A's final build are in this file's git
history (commit `fc36be9`, `docs/design/final/`). That folder now holds the
current design; its own loop is in `../rounds-b/`.

## Round 1: `1-first-build` → `2-after-round-1`

What was off:

- **Laptop:** the converter sentence wrapped "by [date]" onto a second line; DESIGN.md asks for one line on desktop. The 36rem column inside a 1152px page was too narrow.
- **Phone:** the page scrolled sideways (534px wide on a 390px screen). The More options summary is a truncating flex child without `min-w-0`, and the grid column took its full text width as its minimum.
- **Laptop:** the comparison table was cramped. "Worst case" wrapped onto two lines, and each middle-90% range broke over two lines.
- **Dark mode:** the yellow marker sat behind white digits and muddied them.
- **Hedging:** "How the option responds" sat alone at half width, leaving an empty column.
- **Converter:** the today's-cost block reserved more height than it used, leaving a gap above the divider.

Fixes:

- Page width to 1280px, converter column 38rem, narrower amount field.
- `minmax(0, 1fr)` grid columns and `min-w-0` on the summary text.
- Table header kept on one line.
- In dark mode the highlight becomes a bar under the figure.
- Greeks panel spans both columns with its four charts in a row.
- The skeleton is sized exactly like the figure, so the block no longer needs a reserved minimum height.

## Round 2: `2-after-round-1` → `3-after-round-2`

What was off:

- **Laptop:** the sentence still wrapped. The native date input's intrinsic width was 230px.
- **Phone:** the page still overflowed. The "by [date]" group took `flex-basis: 100%` of a grid item that had no minimum width.
- **Phone:** the range chart's axis labels touched ("S$16,000S$18,000") at 324px wide.
- **Laptop:** after the date was given a width, the calendar icon was clipped.

Fixes:

- Date field sized to its contents (`calc(9.2em + 1.75rem)`) and converter column 40rem: one line at 1366.
- Explicit `grid-cols-[minmax(0,1fr)]` on every page grid.
- Two axis ticks below 400px of chart width.

## Round 3: `3-after-round-2` → `4-final`

What was off:

- **Phone (Hedging):** the page overflowed by 8px, from the comparison table's header held on one line.
- **Phone (Hedging):** long hedge names ran into the median text in the range chart.
- **Lighthouse mobile:**
  - Planner performance was 81–84, below main's 93. The LCP was late-rendered text: the results heading, recreated when the planner script replaced its static placeholder.
  - Hedging performance was 59–60, with CLS 0.46: the footer jumped when the panels arrived.
- **Script size:** the new combobox and popover code added about 38 KB to the first-load script.
- **axe:**
  - the range chart was `role="img"` with focusable rows inside (nested-interactive);
  - the footer source links were 28px tall.
- **Phone:** the converter's reserved height was 33px taller than its content, leaving a gap.

Fixes:

- The table header wraps on phones, and cell padding is tighter there.
- The chart uses short names ("Unhedged", "Forward", "Call option") when narrow.
- Section headings are 18px on phones, so the results heading is one line and stays smaller than the static subtitle that paints first.
- Loading placeholders are taller than the screen.
- The forward panel's description is shorter.
- The combobox and help-tip popover load after the page, behind same-size placeholders.
- Variable fonts (one file per family); Jakarta isn't preloaded.
- The wordmark link doesn't prefetch.
- The chart is `role="group"`; footer links are 44px tall.
- The converter's minimum height is measured per breakpoint.
