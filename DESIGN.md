# SpotCheck design system

The single source of truth for SpotCheck's interface. Read it before changing any component. Every value below is defined once, as a token in `app/globals.css`; components use the tokens, never raw values.

The direction: **a financial research publication for ordinary people.** Warm paper, deep ink, one restrained green, editorial serif headings and precise sans-serif figures. Hierarchy comes from type, alignment and thin rules, not from boxes. The product's own data is the only imagery.

The audit that led here is in `docs/design/audit.md`.

## 1. Principles

1. **Question → comparison → evidence → exploration → method.** Every page leads with the user's question and the comparison drawn from the actual calculation. Charts and tables are the evidence. Single periods, assumptions and sources come after, for whoever wants them.
2. **Show what happened; never decide.** SpotCheck lays the four strategies side by side, in a fixed order that never depends on the results, with the same measures for each. It never generates a sentence, label or badge saying which strategy came top or bottom on any measure, even when that would be true: users compare the numbers themselves. Factual differences are fine ("−S$85 vs all at once" in a cell); verdicts are not. No predictive language about rates ("will", "likely to", "expect"). Banned in all UI text: "best", "recommend", "should", "optimal", "winner", "consider converting", "buy now", "guarantee". "Past outcomes, not a forecast" and the historical-context line ("Historical results reflect exchange-rate trends during the periods tested…") sit next to every set of results.
3. **Type before containers.** A heading, a rule and white space separate things. A box is used only for an object that really is separate: the converter, a popover, a table header band.
4. **Colour identifies; it never judges.** The interface is neutral ink on paper. Green marks the interactive and the brand; amber marks a caution notice; red marks errors only. No figure, row or strategy is ever coloured, bolded, badged or reordered to look better or worse. Each strategy keeps one identifying colour everywhere, and highlighting one (dimming the others) happens only when the user hovers, focuses or selects it.
5. **Only real numbers.** Every figure, count and date on screen comes from the data and the engine. No sample, decorative or rounded-up statistics.

## 2. Colour

### Neutrals and meaning

| Token             | Light                       | Dark      | Use                                                           |
| ----------------- | --------------------------- | --------- | ------------------------------------------------------------- |
| `--paper`         | `#F6F4EE`                   | `#111311` | Page background                                               |
| `--surface`       | `#FCFBF8`                   | `#181B19` | The converter, popovers, tooltips                             |
| `--sunken`        | `#EEEBE3`                   | `#1F2320` | Table header bands, the exploration band, skeletons           |
| `--rule`          | `#D9D4C8`                   | `#2C312D` | Dividers and hairlines (decorative, not a boundary to read)   |
| `--input`         | `#8A8578`                   | `#6E756F` | Borders of fields and controls (≥ 3:1 on every surface)       |
| `--ink`           | `#16181A`                   | `#ECEAE3` | Text, headings, figures                                       |
| `--muted`         | `#575B5E`                   | `#A6AAA3` | Secondary text, labels, axes (≥ 5.7:1 on every surface)       |
| `--accent`        | `#1D5C45`                   | `#7CC4A0` | Links, the primary button, focus, the spot motif, active nav  |
| `--accent-strong` | `#164836`                   | `#9AD6B8` | Hover/pressed accent                                          |
| `--accent-fg`     | `#FFFFFF`                   | `#0D1A13` | Text on an accent fill                                        |
| `--accent-soft`   | `#E1EBE4`                   | `#1C2B23` | Selected rows and options                                     |
| `--caution`       | `#8A5800`                   | `#E0B15C` | Caution notes (e.g. blended-rate volatility, USD-only notice) |
| `--negative`      | Errors only. Never a result | `#F0907F` | Errors; a difference that is a higher cost                    |

Contrast (WCAG 2.x): ink 14.9–17.2:1, muted 5.8–7.9:1, accent text 6.6–9.1:1, white on accent 7.9:1, input borders 3.1–3.9:1, all on every background above in both themes.

Dark mode is its own palette with the same roles, chosen for a warm near-black, not an inversion. It follows the system setting.

### Strategy and hedge colours

Validated with the dataviz palette checker (lightness band, chroma, colour-blind separation, contrast) against `--surface` in each theme. Colour is never the only cue: every series is named in place, and the strategies also have marker shapes.

| Slot | Light     | Dark      | Planner             | Hedging     | Shape    |
| ---- | --------- | --------- | ------------------- | ----------- | -------- |
| 1    | `#2763B0` | `#4A86E8` | All at once         | Forward     | circle   |
| 2    | `#C9581F` | `#E0662A` | Equal tranches      | Call option | diamond  |
| 3    | `#00897A` | `#12A388` | Wait until deadline | Unhedged    | square   |
| 4    | `#9150A8` | `#9A72DA` | Target rate         | –           | triangle |

The brand green is deliberately not a strategy colour, so no strategy looks "approved".

Hedging reuses two planner colours on purpose and adds one of its own:

| Hedge       | Colour                                   | Why                                                                        |
| ----------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| Unhedged    | slot 3 (Wait until deadline)             | It is the same strategy: convert everything on the deadline                |
| Forward     | slot 1 (All at once)                     | Both fix the whole cost on day one                                         |
| Call option | `--series-option`: `#9A6B00` / `#B88520` | Its own colour; no planner strategy uses it (validated with the two above) |

## 3. Typography

Two families, self-hosted with `next/font` (the CSP keeps `font-src 'self'`), one file each:

- **Newsreader** (display serif), one static weight (400): page titles (the Planner's question, the H1 of Hedging and How it works) and the wordmark only. Section headings are in the sans, which reads as a product rather than a newspaper. Never for figures, controls or body text.
- **IBM Plex Sans** (interface, variable): everything else. Its tabular figures (`tabular-nums`) keep compared numbers aligned.

| Role        | Family     | Weight | Desktop size / line | Phone   | Notes                                  |
| ----------- | ---------- | ------ | ------------------- | ------- | -------------------------------------- |
| Display     | Newsreader | 400    | 60 / 64             | 36 / 40 | The page question. Tracking −0.015em   |
| H1          | Newsreader | 400    | 44 / 50             | 34 / 40 | Titles of secondary pages              |
| H2          | Plex       | 600    | 24 / 30             | 20 / 26 | Section headings. Tracking −0.01em     |
| H3          | Plex       | 600    | 17 / 24             | 17 / 24 | Sub-headings inside a section          |
| Body large  | Plex       | 400    | 19 / 30             | 17 / 27 | Ledes                                  |
| Body        | Plex       | 400    | 16 / 25             | 16 / 25 | Default; long text capped at 68ch      |
| Small       | Plex       | 400    | 14 / 20             | 14 / 20 | Notes, table cells on phones           |
| Label       | Plex       | 500    | 13 / 16             | 13 / 16 | Field and metric labels, muted         |
| Data large  | Plex       | 500    | 40 / 44             | 32 / 36 | Headline figures. Tracking −0.02em     |
| Data medium | Plex       | 500    | 22 / 28             | 20 / 26 | Secondary figures, the converter field |

Sentence case everywhere. No all-caps eyebrows, no letter-spaced labels.

### Numbers

- **Money:** every S$ figure in one scenario uses the same precision: whole dollars when the scenario costs S$100 or more (differences too: "−S$85"), cents when it costs less (15,000 VND is about S$0.74). The exceptions are per-unit rates, pips, the option premium and the Greeks, which keep their decimals.
- **Settings as percentages:** shown without trailing zeros ("2%", "0.5%").
- **A fixed cost:** a strategy with no range reads "S$19,321 (fixed)", not "S$19,321–S$19,321".

## 4. Space, layout and shape

**Spacing scale (px):** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Components use 4–32. Sections are separated by 96 on desktop and 64 on phones, so the gap between sections is always clearly larger than any gap inside one.

**Layout:**

- **Content width:** max 1200px, with 16px side gutters on phones, 24px on tablets and 40px on desktop.
- **Columns:** 12 columns with 24px gaps from 1024px. Text measures cap at 68ch, so nothing stretches on wide screens.
- **Breakpoints:** 640 (large phone), 768 (tablet), 1024 (laptop), 1280 (desktop).

**Composition varies by section:**

- **Hero:** asymmetric, 7 + 5 columns: the question and converter on the left, the glance panel on the right.
- **Evidence:** a heading row (title left, how to read it right), then the range chart, the full comparison table and the plain-English summary at full width.
- **Exploration:** a full-width sunken band, the densest section.
- **Strategies:** a sticky heading rail beside a long text column.
- **Evidence strip:** four figures in one row divided by vertical rules.

**Radii:**

- 4px: small controls, tags and the table header band.
- 6px: fields, buttons and the currency menu.
- 8px: the converter and popovers only.

No pills. Nothing is fully rounded except the spot motif and swatches.

**Shadows:** none on page content. Popovers, tooltips and the currency menu use one soft shadow (`--shadow-pop`). Depth otherwise comes from `--surface` against `--paper` and from rules.

**Borders:** 1px `--rule` for dividers; 1.5px `--input` for fields; 2px `--accent` for the active nav underline.

## 5. The spot motif

A filled dot on two hairlines, a crosshair at a single point:

```
      │
  ────●────
      │
```

It stands for checking one point in history, a spot rate and the name.

It appears only in these places:

- the logo mark and favicon;
- the cursor on the outcome timeline (a vertical hairline with a dot on each series);
- the marker for the selected period;
- the progress indicator while periods are checked, where a dot travels along a hairline.

It never appears as decoration elsewhere.

## 6. Charts

One chart language across both pages:

- **Axes:** hairline axes in `--rule`, tick labels in `--muted` at 12–13px tabular figures.
- **Gridlines:** no vertical gridlines; horizontal gridlines in `--rule`.
- **Lines and bars:** lines 2px. The middle-90% bars are 10px tall with 2px corners, the median dot is 9px with a 2px `--surface` ring, and the full-range whisker is a 1.5px `--muted` line.
- **Highlight:** hovering or focusing a strategy (a chart row, a legend item, a glance row, a table row) previews it; clicking pins it (`aria-pressed`); clicking again unpins. The others dim over 150ms: chart rows to 30% opacity, table rows to 40–45%, and the timeline lines to 15%. Nothing is ever highlighted automatically.
- **Tooltips:** `--surface`, 1px `--rule` border, 8px radius and `--shadow-pop`. They show the period in bold, then one row per strategy in the fixed order: swatch, name, cost and its difference from all at once. No row is singled out.
- **Touch:** on touch screens, dragging horizontally across the timeline scrubs it and lifting selects the period. Vertical drags still scroll the page. The Recharts charts (period detail, payoff, Greeks) show no floating tooltip on touch, because it stays open and covers the chart. A fixed readout row under each chart shows the tapped values instead.
- **Axes:** rate axes use round ticks (1.10, 1.20, …), kept inside the plotted range. The timeline's cost axis fits the data with a 5% margin rather than stretching to whole tick steps.
- **States:** a chart's space is held by a `--sunken` block of the same height while it loads. An error replaces it with a one-line message in `--negative`.
- **Accessibility:** every chart has a text equivalent: the comparison table, the conversions table, a slider with a spoken value, or a summary label.

## 7. Components

| Component        | Rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header           | `--paper` with a bottom rule, 64px desktop / 56px phone. Logo mark plus "SpotCheck" in Newsreader. Nav: Planner, Hedging, How it works as text links; the active one gets ink text and a 2px accent underline, plus `aria-current`. Right: "Historical data, not advice".                                                                                                                                                                                                                         |
| Bottom tab bar   | Phones only: three equal 56px targets (icon and label), `--paper` with a top rule, safe-area padding.                                                                                                                                                                                                                                                                                                                                                                                             |
| Converter        | The one boxed object on the page: `--surface`, 1px `--rule`, 8px radius, no shadow. The sentence "I need [amount] [currency] by [date]", then the baseline "Converting it all today: S$X", then More options.                                                                                                                                                                                                                                                                                     |
| Sentence fields  | 6px radius, 1.5px `--input` border, `--surface` fill, Data-medium type. On focus a 3px accent focus ring appears. The amount grows with its digits; the date is sized to its content.                                                                                                                                                                                                                                                                                                             |
| Currency picker  | A button showing the flag and code. It opens a menu with a search field (code, currency name, country), popular destinations first, then A–Z. Flags appear only here.                                                                                                                                                                                                                                                                                                                             |
| More options     | A disclosure with its current values summarised in one line; closed by default.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Result           | Renamed **Glance**: a panel (`--surface`, 1px `--rule`, 8px radius) beside the converter. "Across N comparable past periods", then all four strategies in the fixed order with the same two figures: median and median vs all at once. Each row's name is a button that pins the highlight. Then the historical-context line, "Past outcomes, not a forecast.", Copy link and "See the full comparison". While periods are checked: the progress motif and "Checking N comparable past periods…". |
| Metric           | A figure over a short label, left-aligned. Never boxed, never coloured by value.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Comparison table | One row per strategy in the fixed order: Median, Median vs all at once, Middle 90% (low–high), Worst case, Cheaper than all at once (% of periods). Hedging uses the same table against "unhedged". Header band on `--sunken` with 4px radius, row rules, right-aligned tabular figures. On phones the same measures stack per strategy. Every row is styled identically whatever the results; tests check this across very different histories.                                                  |
| Outcome timeline | Each strategy's cost (rescaled to today's rate) by the period's start date, with the spot cursor, a tooltip and click/tap to select. Laptops draw every daily period (each pixel column's low and high). Phones group by month: a band from the month's lowest to highest cost with a median line, plus 44px "Earlier month"/"Later month" buttons. Grouping is display only; selection, detail and export use the daily periods.                                                                 |
| Strategy guide   | For each strategy: swatch and name, "What you'd do", and "What it trades" in one or two sentences. A "More detail" disclosure holds the rest.                                                                                                                                                                                                                                                                                                                                                     |
| Evidence strip   | Years of data, periods tested, separate histories and rates up to a date, each a figure over a label, divided by vertical rules. Then the sources line and a link to How it works.                                                                                                                                                                                                                                                                                                                |
| Buttons          | Primary: `--accent` fill with `--accent-fg` text. Secondary: transparent with `--ink` text and a 1.5px `--input` border. Both 44px tall, 6px radius, Plex 500 15px, with hover, pressed, focus-ring, disabled (50% opacity) and busy ("Preparing…") states. One primary per screen.                                                                                                                                                                                                               |
| Links            | `--accent`, underlined 1px with a 3px offset; hover thickens the underline.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Help tips        | An "i" in a 22px circle (1.5px `--input` border) inside a 44px hit area; it opens a popover titled "What is …?". Hedging only.                                                                                                                                                                                                                                                                                                                                                                    |
| Focus            | A 3px `--accent` outline at 2px offset on everything focusable.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Footer           | `--paper`, top rule, Small type. The disclaimer, the sources as a list and the date rates run to.                                                                                                                                                                                                                                                                                                                                                                                                 |
| Icons            | Lucide only, 16–20px, used only where they help recognition (nav on phones, download, link, search, chevrons).                                                                                                                                                                                                                                                                                                                                                                                    |

## 8. Motion

Motion appears only in response to something the user did, or to show progress:

- **Fades:** series dim and results fade in over 150ms.
- **Progress:** the spot motif travels its hairline over 1.2s while periods are checked.
- **Disclosures:** open without animation.
- **Reduced motion:** with `prefers-reduced-motion`, everything is instant and the progress dot stays still.

## 9. Responsive rules

- **Phones (< 640):**
  - One column. Order: the question, the converter, the result, then the evidence.
  - The sentence wraps as "I need [amount] [currency]" then "by [date]".
  - The comparison table uses Small type and lets the middle-90% cell break after its dash.
  - The timeline is 220px tall.
  - The bottom tab bar replaces the header nav.
- **Tablets (640–1023):** one column at a wider measure; the evidence strip shows two figures per row.
- **Laptops (≥ 1024):** the asymmetric layouts described in section 4 switch on. The header nav appears.
- **Wide screens:** content stops at 1200px; charts never stretch beyond it.

## 10. History

Two earlier directions came first: the proposal mockups (`docs/design/mockups/`) and the navy Direction A (PR #7, with its screenshot loop in `docs/design/rounds/`). This direction keeps their working parts:

- the converter;
- the currency search;
- the comparison table;
- today's-cost arithmetic;
- the tests.

It replaces their look and page structure. Its own screenshot loop is in `docs/design/rounds-b/`.
