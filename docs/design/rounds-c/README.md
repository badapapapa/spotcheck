# Screenshot loop: the neutral revision of PR #8

This loop follows the PR #8 review. The changes:

- the question became "What difference does your exchange strategy make?";
- every generated verdict ("X had the lowest median…") was removed;
- the four strategies are shown side by side in a fixed order with the same measures;
- the wording tests were restored and extended;
- the phone timeline was regrouped by month;
- the editorial look was refined into a more product-like interface.

Every round renders the real static build with Playwright at 390×844 (phone, 2× pixels) and 1366×768 (laptop), light and dark, for the Planner, Hedging and How it works. The scenario is fixed: `?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2`. File names follow `{planner|hedging|how}-{phone|laptop}-{light|dark}.jpg`; each image is the first screen. Full pages of the final build are in `../final/`.

| Folder             | State                                                |
| ------------------ | ---------------------------------------------------- |
| `0-before/`        | PR #8 as reviewed, with the "lowest median" headline |
| `1-first-build/`   | Verdicts removed, the neutral glance, the new copy   |
| `2-after-round-1/` | After round 1's fixes                                |
| `3-final/`         | After round 2's fixes and the performance pass       |
| `states/`          | Interaction states of the final build (see below)    |

## Round 1: `1-first-build` → `2-after-round-1`

What was off:

- **Still a newspaper:** every section heading was the large serif, which read as editorial rather than a product. The serif is now kept for page titles only (the question, and the H1s of Hedging and How it works); section headings are in IBM Plex Sans 600.
- **Cramped comparison table:** with six measures, the table squeezed into an 8-of-12 column, so headers and ranges wrapped. It now has the full width under a heading row (title left, how to read it right).
- **A loose glance:** the at-a-glance comparison sat on the page with only a left rule, though it is an interactive object (select a strategy to follow it). It is now a panel next to the converter, matching it, so the hero reads as two instruments side by side.
- **Hedging's headline** used the serif "result" style, which no longer exists. It is now a sans statement of the forward's price, in the Hedging section-heading style.

## Round 2: `2-after-round-1` → `3-final`

What was off:

- **Faint phone bands:** the monthly low–high bands were almost invisible in dark mode at 16% opacity. They are now 24%.
- **Placeholder heights:** the glance is now a padded panel, so its loading placeholder heights were re-measured at ten widths, 360–1600px. The Planner and Hedging record no layout shifts while loading.
- **Lighthouse:** one Planner run scored 86. The page's first script carried the chart library for the period detail, far below the first screen. The timeline and the period detail now load just after the page, into same-size placeholders. The Planner scores 97 on every run.

## `states/`

- `pinned-glance-*`, `pinned-evidence-*`: Equal tranches selected from the glance. It stays highlighted in the range chart and the table; the others dim. Nothing is highlighted until the user picks something.
- `timeline-hover-*`: the spot cursor and tooltip. Every strategy is listed in the fixed order with its cost and its difference from all at once.
- `phone-timeline-*`: the phone view, one point per month: each month's band from lowest to highest cost, its median line, and 44px buttons to step a month at a time.
- `progress-phone`: "Checking 6,922 comparable past periods…" while the replay runs.
