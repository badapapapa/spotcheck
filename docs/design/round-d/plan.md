# Round D: UI/UX refinement — audit and plan (Phase 1)

A refinement of the current editorial direction, not a redesign. Every change below names the problem it fixes and the screenshot that shows it.

## The baseline

`before/` is production (`main` at `29dc164`, rates to 30 Oct 2026), captured on 1 Nov 2026 with `scripts/design-shots.ts`:

- **States (20):**
  - **Planner:** top, comparison, plain words, timeline, period detail, strategies.
  - **Hedging:** top, forward, option, Greeks, history.
  - **How it works:** top, strategies, data.
  - **Other states:** 404, the currency picker (open, and with a search that matches nothing), invalid input, data error, loading.
- **Sizes:**
  - **375×812 and 430×932:** phones, 2× pixels, touch.
  - **768×1024:** tablet, touch.
  - **1440×900 and 1920×1080:** mouse.
- **Themes:** light and dark, for 200 files named `{state}-{width}-{theme}.jpg`.
- **Locale:** `en-SG`, Singapore time.
- **How each shot is taken:**
  - Sections are clipped from a full-page capture, so the phone bars appear only in the `-top` shots.
  - The data-error state blocks the FX files.
  - The loading state holds every data file.

The same script, run against the branch, will produce `after/` with identical filenames. Only 375 and 1440 are committed; see the [README](README.md) for the local sizes.

(`docs/design/rounds-d/` is the older final-review round of PR #8. This round lives in `round-d/`, as the brief asks.)

## Already done in PR A and PR B (build on these, don't redo them)

- **Legends:** in the fixed order on every chart, with the period chart's own tooltip and legend (B2).
- **Touch:** a fixed readout row instead of floating tooltips (PR #8, B2).
- **Focus:** one 3px accent ring everywhere, including date fields with the calendar button focused (B4).
- **Overflow:** no horizontal overflow from 320px, or at large text sizes (B4).
- **Highlighting:** it dims marks, not text (B3).
- **Announcements:** results changes are announced politely; the skip link exists; chart focus stops are gone (B1, B4).
- **Inputs:** strict number parsing with plain error messages, and start-date coverage messages (PR A).

## Keep (unchanged)

- **Palette:** the paper, ink and green palette in both themes, and the four strategy colours and their marker shapes. The reference light palette was tested below, and the current one stays.
- **Type:** Newsreader for page titles only and Plex for everything else, plus the question "What difference does your exchange strategy make?".
- **Converter:** the sentence-style converter ("I need [amount] [currency] by [date]") and its single boxed surface.
- **Glance panel:** the four strategies in the fixed order with the same two figures each.
- **Comparison:** the range chart plus table (fixed order, identical styling per row, right-aligned tabular figures), the "(fixed)" range and the U+2212 minus.
- **Timeline:**
  - the monthly bands on phones and every daily period on laptops;
  - grouping for display only;
  - the 44px month buttons.
- **Page structure:** the How it works structure, its sticky section rail, and its metadata-driven coverage dates and sources (`data/meta.json`).
- **Header:** the header disclaimer at every width and the bottom tab bar.

## Problems, ranked by impact

Each problem is given as problem → evidence → change → effect.

### 1. On a phone, the first results are below the fold

- **Evidence:** [`planner-top-375-light`](before/planner-top-375-light.jpg) and `planner-top-430-light` (local set).
  - At 375×812 the glance heading starts at 680px, and its first figure is under the 56px tab bar.
  - The page is 8,313px tall at 375 (about 10 screens), against 5,059px at 1440.
- **Change:**
  - Tighten only the phone hero:
    - display 36→32px;
    - the lede at body size;
    - smaller gaps above and inside the converter;
    - the mid-rate line folded into one line under "Converting it all today".
  - Shorten the glance intro to one line, and move "Select a strategy…" to the table's caption.
- **Effect:**
  - At 430×932, all four medians are visible without scrolling.
  - At 375×812, the glance heading and its first row are visible.
  - Desktop is unchanged.

### 2. The deadline shows as an ambiguous numeric date

- **Evidence:** "01/09/2027" in [`planner-top-375-light`](before/planner-top-375-light.jpg) and [`planner-top-1440-light`](before/planner-top-1440-light.jpg). That is 1 Sep in `en-SG`, but `en-US` shows 09/01/2027.
- **Change:**
  - At rest, the field reads "1 Sep 2027". While it is focused, it shows the browser's own date editing.
  - The native `<input type="date">` stays the real control, so typing, the native picker and the accessible name keep working.
  - It is a CSS swap with no layout shift, applied to the start-date field in More options too.
- **Effect:** the date reads one way in every locale, with no new dependency.

### 3. Currency picker: the empty search is broken, and flags render as letters on Windows

- **Evidence:**
  - [`picker-empty-375-light`](before/picker-empty-375-light.jpg): "zzz" leaves a bare "Matches" heading. The "No currency matches" message never shows, because an empty group still renders.
  - [`picker-open-375-light`](before/picker-open-375-light.jpg): emoji flags on every row and on the trigger. EUR has no single country, and Windows shows "US".
- **Change:**
  - **Empty search:** hide empty groups, and show "No currency matches "zzz". Try a country (Japan), a name (yen) or a code (JPY)."
  - **Flags:** remove them from the trigger and the list, leaving code plus name. Search by country stays (`lib/currency-search.ts`).
  - **Selected vs highlighted:** the selected row gets the check and `--accent-soft`, and the keyboard highlight stays `--sunken`. Today both look the same on USD.
  - **Engine:** `engine/currencies.ts` keeps its `flag` field (no engine change); the UI just stops rendering it.
- **Effect:** a clear empty state, identical rendering on every OS, and a visible difference between the selected and the highlighted option.

### 4. The same things have different names

- **Evidence:**
  - **"periods" and "windows":** the table and glance say "periods" (21 strings); the plain words and Hedging history say "windows" (17). See [`planner-plain-words-375-light`](before/planner-plain-words-375-light.jpg) and [`hedging-history-375-light`](before/hedging-history-375-light.jpg).
  - **Worst case:** "Worst case" and "Worst-case cost" ([`hedging-option-375-light`](before/hedging-option-375-light.jpg)).
  - **Wait until deadline:** the Planner's "Wait until deadline" is Hedging's "Unhedged (convert on deadline)".
- **Change:**
  - "past periods" everywhere in the UI;
  - "Most expensive past period" for worst case;
  - "Unhedged" on Hedging, with "(the planner's Wait until deadline)" on first use and in its legend entry.
- **Effect:** one word per idea, across pages. **This touches a safeguard test; see Risk 1.**

### 5. The terms are unexplained for a first-time student

- **Evidence:**
  - [`planner-top-1440-light`](before/planner-top-1440-light.jpg) shows "spread" and "mid rate" undefined, a "vs all at once" column with no key, and no rate direction.
  - [`planner-comparison-1440-light`](before/planner-comparison-1440-light.jpg): "58% of periods" could read as a probability.
- **Change:**
  - **Spread:** "Exchange fee (spread)" in More options and its summary.
  - **Mid rate:** defined once in the converter: "midpoint between buy and sell prices, before fees".
  - **Rate direction:** stated once next to the rate line: "SGD per USD: lower = cheaper for you".
  - **Equal tranches:** a subtitle "convert in equal parts" under the name wherever it heads a block (the strategy guide, the phone comparison).
  - **Column key:** "negative = cost less than converting all at once" under the glance and the table.
  - **Percentages:** "a share of past periods, not a probability" next to the "Cheaper than all at once" column.
- **Effect:** the 10-second read. The technical terms stay, in help tips.

### 6. The selected period on the timeline is almost invisible, and selection is split across two controls

- **Evidence:**
  - [`planner-timeline-1440-light`](before/planner-timeline-1440-light.jpg) and [`planner-timeline-375-light`](before/planner-timeline-375-light.jpg): the default (latest) period's cursor sits on the plot's right edge, with its dot floating above the plot rather than on the series.
  - [`planner-period-375-light`](before/planner-period-375-light.jpg): a separate "Start of the period" slider below repeats the heading "The period starting 30 Dec 2025".
- **Change (Phase 4):**
  - **One scrubber:** the timeline becomes the one control, focusable as `role="slider"`.
    - Keys: ←/→ a day, PgUp/PgDn a month, Home/End.
    - Its `aria-valuetext` gives the date and all four costs.
    - It drags to scrub with the mouse and touch; vertical touch drags still scroll.
  - **The duplicate slider is removed.** The month buttons stay.
  - **Readout:** a fixed row above the plot shows the date and the four values in the fixed order. It never covers the lines, and replaces the floating tooltip at every width.
  - **Marker:** the spot motif is a hairline with a dot on each series. The plot gets right padding, so the latest period isn't on the edge.
  - **Legend:**
    - hovering or focusing an item previews it;
    - a click locks it;
    - a "Clear" button and Esc unlock it;
    - lines dim to 15% and text stays at ≥4.5:1.
- **Effect:** exploring feels like one instrument, and the readout values match the table (tested).

### 7. The period detail hides markers, and its conversions are hard to read on phones

- **Evidence:** [`planner-period-1440-dark`](before/planner-period-1440-dark.jpg) and [`planner-period-375-light`](before/planner-period-375-light.jpg).
  - All at once's circle is hidden under Equal tranches' first diamond.
  - Wait until deadline's square is under Target rate's triangle.
  - The legend is centred and wraps, unlike the timeline's.
  - On phones every conversion breaks into "date ·" / "rate", so Equal tranches takes 12 lines.
- **Change:**
  - Coincident markers are drawn side by side (±5px), so every shape shows.
  - One left-aligned legend component for all charts.
  - Phone conversions are a two-column sub-grid (date left, rate right), still without overflow at 320.
- **Effect:** every strategy is visible on the chart, and the table is half as tall on phones.

### 8. Hedging: no intro, a figure that reads as a saving, unlabelled axes and a different form

- **Evidence:**
  - [`hedging-top-1440-light`](before/hedging-top-1440-light.jpg):
    - "S$409 below today's spot" reads like a saving;
    - the right 40% of the hero is empty;
    - the form is unboxed while the Planner's is boxed;
    - three stat figures repeat values shown again below.
  - [`hedging-option-375-light`](before/hedging-option-375-light.jpg):
    - the payoff x-axis has no label;
    - the legend is Recharts' default (centred, line-and-circle icons);
    - the native `<select>` for the lookback looks unlike the other fields;
    - the computed volatility shows as a grey placeholder that looks disabled.
  - [`hedging-greeks-1440-light`](before/hedging-greeks-1440-light.jpg): the Greek charts have no axis labels, and an unlabelled dashed line.
- **Change:**
  - **The hero, top to bottom:**
    - the same boxed converter as the Planner;
    - a short intro: what it shows, what you enter, what comes out, and the key assumptions, in the empty right column on laptops and under the title on phones;
    - the forward line reworded to "fixes a rate S$409 below today's because of the interest-rate gap".
  - **Charts:**
    - x-axes labelled "SGD per USD on the deadline";
    - "today" labelled on every Greek chart;
    - the shared legend.
  - **Fields:**
    - a select styled as a field;
    - the computed volatility shown as a value with "from past rates" and a clear override.
  - **Help tips:** for SORA, fed funds, carry, strike, notional, and realised vs implied volatility.
- **Effect:** the same system as the Planner, and controls clearly tied to the charts they drive.

### 9. Invalid input leaves stale results unmarked, and the sentence re-wraps

- **Evidence:** [`state-invalid-375-light`](before/state-invalid-375-light.jpg).
  - "1.500,50" is invalid, but "Converting it all today: S$19,271" (for 15,000) and the glance stay as if current.
  - The longer value pushes USD onto its own line.
- **Change:**
  - While a field is invalid or results are recomputing, the results are marked "Showing USD 15,000" and dimmed to `--muted` (text stays ≥4.5:1).
  - The marker is cleared as soon as new results arrive.
  - The amount field gets a max width, so the sentence keeps its shape.
- **Effect:** results never look current when they aren't (Phase 6 "stale results stay visibly marked").

### 10. Comparison: long on phones, and the same figures three times

- **Evidence:**
  - [`planner-comparison-375-light`](before/planner-comparison-375-light.jpg): the section is 2,320px tall at 375.
  - The glance, the table and "In plain words" repeat the same figures.
  - [`planner-comparison-1440-light`](before/planner-comparison-1440-light.jpg): at 1440 the plain words leave the right 40% empty.
- **Change:**
  - **Phones:** the per-strategy blocks use tighter rows. "In plain words" becomes a disclosure ("Read the results as sentences"), still in the DOM.
  - **Laptops:** the right column holds the measure key, the historical-context line and the trend note (problem 11).
- **Effect:** about a screen less scrolling on phones, and no dead column on laptops.

### 11. The long-trend caveat is only on How it works

- **Evidence:** the 2004–2013 USD sentence is in `Methodology.tsx` only; no results section mentions it ([`planner-comparison-1440-light`](before/planner-comparison-1440-light.jpg)).
- **Change:**
  - A factual note beside the results, computed from the loaded series so it is right for every currency, e.g. "Across this history SGD per USD went from {first} ({date}) to {last} ({date}). Periods when it fell favoured converting later."
  - The historical-context line stays, and links to How it works.
- **Effect:** the main bias in the history sits next to the numbers, with no hard-coded figures.

### 12. Tokens: off-scale type sizes, and dead code

- **Evidence:**
  - 25 one-off sizes in components:
    - `text-[15px]` ×8 (buttons, nav, tables, value rows);
    - `text-[12px]` ×6 (chart ticks);
    - 13, 14, 18, 23 and 28px;
    - Tailwind's `text-sm`/`text-xs`/`text-2xl` mixed in with the `t-*` tokens.
  - DESIGN.md's scale has no 15px "UI" or 12px "chart" step, though both are used everywhere.
  - Motion has a single 150ms token.
  - `PageTitle.tsx` (extrabold, off-scale) is unused.
- **Change:**
  - **Type scale:** add `t-ui` (15/22), `t-chart` (12/16) and `t-annotation` (13/18) to the scale; map every one-off and Tailwind size onto a token.
  - **Motion:** add `--base: 200ms` for state transitions.
  - **Cleanup:** delete `PageTitle.tsx`.
  - **DESIGN.md:** one table covering display, page, section, subsection, body, supporting, label, annotation, chart and figures.
- **Effect:** one scale, defined once.

### 13. The page's only filled button is Copy link

- **Evidence:** [`planner-top-1440-light`](before/planner-top-1440-light.jpg). The green filled button in the glance draws the eye to sharing, not to the results.
- **Change:** Copy link becomes a secondary button. Green stays for the brand, links, active selection and the focus ring.
- **Effect:** the colour hierarchy matches the brief, and the planner has no competing call to action.

### 14. Smaller polish

- **Phone timeline layout** ([`planner-timeline-375-light`](before/planner-timeline-375-light.jpg)):
  - the legend takes two 44px rows with a wide gap;
  - the month buttons are stacked full-width (about 110px);
  - the x-axis has three labels.
  - **Change:** a 2×2 legend, side-by-side "‹ Earlier" / "Later ›" buttons (still 44px) and one more axis label.
- **404** ([`404-375-dark`](before/404-375-dark.jpg)):
  - the copy says the pages are "linked at the top of the page", but phones have the nav at the bottom;
  - the 404 page has no font preload, so it first renders in the fallback font.
  - **Change:** neutral copy, and the same preloads as the other pages.
- **Data error** ([`state-data-error-375-light`](before/state-data-error-375-light.jpg)): the converter shows "Converting it all —" above an empty line.
  - **Change:** "Rates didn't load" in muted text, with no empty line.
- **How it works** ([`how-top-1440-light`](before/how-top-1440-light.jpg), [`how-strategies-1440-light`](before/how-strategies-1440-light.jpg)): there is no quick visual.
  - **Change:** a conceptual timing diagram (start → deadline) showing when each strategy converts, including Target rate's fallback to the deadline (dashed). It has no numbers, so it can't invent any.
  - The full methodology follows unchanged in substance.

## Generic AI patterns actually seen

- **Emoji flags used as icons:** in the picker and its trigger ([`picker-open-375-light`](before/picker-open-375-light.jpg)). They render as letters on Windows, and EUR has no flag. Fix: problem 3.
- **Library-default chart chrome:** on the payoff chart, a centred Recharts legend with line-and-circle icons and unlabelled axes, next to our own left-aligned legends elsewhere ([`hedging-option-375-light`](before/hedging-option-375-light.jpg)). It's the one place where the product looks assembled rather than designed. Fix: problems 7 and 8.
- **A "three big numbers" strip:** at the top of Hedging ([`hedging-top-1440-light`](before/hedging-top-1440-light.jpg)).
  - The forward rate, premium and 52% are each repeated in the section below.
  - Putting a cost and a percentage side by side as equals invites comparison.
  - Fix: the strip becomes the intro (problem 8), and the figures stay in their sections.
- **The same caveat in three styles:**
  - "Historical results reflect…" in bold small text;
  - "Past outcomes, not a forecast." in bold;
  - "These are past outcomes, not forecasts…" in body text.
  - They are scattered across the glance, the table and the plain words ([`planner-comparison-375-light`](before/planner-comparison-375-light.jpg)). The wording stays (DESIGN.md requires it next to every set of results), but it gets one style and one position per results block.
- **Seen but justified, so not changed:**
  - the converter and glance boxes (the only two cards, never nested);
  - the help-tip circles;
  - the "What you'd do." / "What it trades." lead-ins, which help scanning.

## Presets ("Exchange semester", "Short trip")

My recommendation is not to add them this round.

- **Clutter:** on a phone they would push the results further down (problem 1).
- **Invented amounts:** any preset amount would be a value we made up.
- **Already covered:** the default scenario (USD 15,000, about ten months) already reads as a semester.

If you want them anyway, the least intrusive form is two text buttons inside More options that only set the dates (5 months; 2 weeks), with the values visible in the fields and no strategy selected.

## Colour check: the reference light palette

The reference palette (#F7F7F2 / #182A27 / #236A57 / #E5EDE7 / #CB9857) against the current one:

| Pair                     | Reference  | Current          |
| ------------------------ | ---------- | ---------------- |
| Ink on paper             | 13.96:1    | 16.19:1          |
| Accent on paper          | 5.97:1     | 7.15:1           |
| Accent on accent-soft    | 5.38:1     | 6.45:1           |
| White on accent          | 6.42:1     | 7.9:1            |
| Secondary #CB9857, paper | **2.39:1** | (caution) 5.49:1 |

Every pair is lower than in the current palette.

- **#CB9857 fails:** it falls below 3:1 even for UI components.
- **It's too close to the option series:** it is near `--series-option` (#9A6B00), which would blur the hedge colours.

So the current light theme stays. The "one restrained secondary accent" is the existing `--caution` amber, used only for caution notes.

## Risks

1. **The safeguard test:**
   - `tests/advisory-patterns.ts` `STRATEGY_SENTENCE` hard-codes "worst case" and "of windows".
   - Problem 4 needs that regex updated to "most expensive past period" and "of past periods", **with the same strictness**: one template, the same measures, against all at once only.
   - It's a change to a safeguard, so I need your OK first. Three other test files (`summary.test.ts`, `comparison-table.test.ts`, `e2e/hardening.spec.ts`) assert the old words; they get the new words, never a looser match.
2. **The timeline scrubber (problem 6):**
   - **Tests:** existing e2e tests drive the period slider; they will be rewritten against the new slider, with the same assertions.
   - **Performance:** scrubbing must stay smooth at 4x CPU. Selection only re-renders the readout, marker and period detail, all memoised; the daily data stays complete.
3. **The date overlay (problem 2):** native date inputs differ across Chrome, Safari and Firefox. The native control stays the source of truth, and it is tested under the de-DE and America/Los_Angeles projects.
4. **Parity:** no engine, data or calculation changes. Label renames change the text the parity script keys on, so only its selectors change; every figure must stay identical.
5. **The trend note (problem 11):** it is computed from the loaded series (first and last rate), never hard-coded, and checked by the wording detector across the 30-scenario sweep.
6. **The How it works diagram:** it is conceptual and must match the engine's rules: the first tranche on the start date and the last on the deadline, and Target rate falling back to the deadline. A unit test will check the diagram's events against the strategy definitions.
7. **Accessibility:**
   - The slider needs a full `aria-valuetext`.
   - Legend items are `aria-pressed` buttons.
   - The stale marker must keep text at ≥4.5:1.
   - axe and a keyboard walkthrough run at the end of each phase.
8. **Performance and CLS:**
   - The question stays the static LCP element.
   - New client code goes in the already-lazy chart chunks.
   - The date overlay and the stale marker must not move the layout.
9. **Repo size:** `before/` is 20 MB (200 JPEGs), and `after/` will be about the same. The earlier rounds are 5–9 MB each. If that's too heavy, I can commit only 375 and 1440 to git and keep the rest out of the repo.

## Order of work

| Phase | Problems                                                                  |
| ----- | ------------------------------------------------------------------------- |
| 2     | 12, 13, the shared legend and field components (part of 7 and 8)          |
| 3     | 1, 2, 3, 4, 5, 9, 10, 11                                                  |
| 4     | 6, 7, 14 (the phone timeline)                                             |
| 5     | 8, 14 (How it works, 404)                                                 |
| 6     | Motion tokens in use, the stale states, CLS, and the 375/430 walkthroughs |

Each phase ends with a full re-capture and a look at the shots before moving on.

## Decisions needed from you

1. Updating the `STRATEGY_SENTENCE` safeguard to the new words at the same strictness (Risk 1).
2. The timeline as the one scrubber, replacing the period-detail slider (problem 6).
3. The trend note computed from data for every currency (problem 11), rather than the USD-only 2004–2013 sentence.
4. No presets this round.
5. Keeping the current light palette.
6. Screenshot weight: commit everything (about 40 MB with `after/`), or only 375 and 1440.

## Decisions (approved 1 Nov 2026)

1. **Safeguard:** `STRATEGY_SENTENCE` moves to the new words, with proof that it is equally strict: the same advisory and ranking sentences (including comparisons between two non-reference strategies and mismatched measures) are run against the old and the new pattern, and both must reject every one. Nothing else is loosened.
2. **Timeline:** it becomes the one scrubber; the month buttons stay.
3. **Trend note:** computed from the data, with symmetric wording: "Across this history SGD per {CCY} went from {first} ({date}) to {last} ({date}). In periods when the rate fell, converting later cost less; when it rose, it cost more." It is checked by the wording detector across the 30-scenario sweep.
4. **Presets:** none.
5. **Palette:** the current one stays.
6. **Screenshots:** only 375 and 1440 (both themes) are committed for `before/` and `after/`; the other sizes stay in the git-ignored `local/` folder.
7. **Date field:** if the "1 Sep 2027" overlay is fragile in any engine (iOS Safari above all, where a tap must still open the native picker), the fallback is the formatted date as text next to the field. The report says which shipped and why.
8. **Extra gate after Phase 4:** stop with the before/after screenshots for Phases 2–4 and the preview URL, before Hedging and polish.
