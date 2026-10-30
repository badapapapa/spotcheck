# DESIGN.md — SpotCheck

The single source of truth for SpotCheck's UI: palette, type, spacing, radii, shadows, chart colours and component rules. **All UI work follows this file.** If a component needs something this file doesn't cover, add it here first.

Direction: **A · Bank-classic navy**, chosen from the two directions in `docs/design/mockups/` (proposal history), with the review changes below.

## 1. What the page is for

SpotCheck is a tool, not a landing page. A student types an amount, a currency and a date, and sees what converting would have cost under four approaches. The first thing on screen is that converter, and the one memorable element is **the cost of converting today**, highlighted once.

Principles:

1. **Tool first.** Compact header, no hero band, no marketing pill. The converter is above the fold at 390×844 and 1366×768.
2. **One bold thing.** The highlighted cost number is the only yellow on the page apart from the active-tab bar. Everything around it is quiet.
3. **Rows, not boxes.** Structure comes from alignment, dividers and white space. No card inside a card. Label on the left, value on the right, numbers right-aligned with tabular figures wherever they are compared.
4. **Same measures for everyone.** Strategies and hedges are compared on identical columns. Nothing is styled as "better".
5. **Plain words.** Sentence case, active voice, no all-caps labels, no "·"-joined meta strings, no arrows appended to links.

### Review against generic defaults

| Generic default the first draft had                           | Changed to                                                                                     | Why                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Full-width navy hero band with headline and pill badge        | Compact white header; small page title row                                                     | The tool is the hero; the converter must be above the fold          |
| Inter for everything                                          | IBM Plex Sans body, Plus Jakarta Sans headings                                                 | Plex has clear, true tabular figures; two clearly distinct families |
| Every block in an identical rounded card with the same shadow | Two panels (converter, results) on desktop; everything else is an open section with a top rule | Cards only where they group a task; hierarchy from space            |
| Three stat tiles with different measures                      | One comparison table with the same columns for every strategy                                  | Like-for-like comparison                                            |
| "A · B · C" meta strings                                      | Commas, or separate labelled rows                                                              | Reads as prose, not chrome                                          |
| Emoji as icons                                                | One icon set (lucide), used sparingly; flags only as content in the currency list              | Consistent, accessible                                              |

## 2. Layout

Desktop (≥ 1024px), max content width 1200px:

```
┌ header 64px ─────────────────────────────────────────────────────────┐
│ [icon] SpotCheck     Planner  Hedging          Not financial advice    │
├──────────────────────────────────────────────────────────────────────┤
│ Exchange money planner                                                 │
│ Replays four ways of converting over every comparable period.          │
│                                                                        │
│ ┌ converter panel (5/12) ──────┐  ┌ results panel (7/12) ──────────┐  │
│ │ I need [15,000] [USD ▾] by   │  │ What each approach would cost   │  │
│ │ [1 Aug 2027]                 │  │ Source: ECB …   [Copy] [Excel]  │  │
│ │                              │  │ ─────────────────────────────── │  │
│ │ Converting today             │  │ range chart                      │  │
│ │ S$19,284  ← yellow mark      │  │ ─────────────────────────────── │  │
│ │ S$19,188 at mid rate, before │  │ comparison table                 │  │
│ │ your 0.5% spread             │  │ summary                          │  │
│ │ ───────────────────────────  │  └─────────────────────────────────┘  │
│ │ More options            ▾    │                                       │
│ └──────────────────────────────┘                                       │
│ ── Look at one window ──────────────────────────────────────────────── │
│ ── Methodology ─────────────────────────────────────────────────────── │
├ footer (navy) ───────────────────────────────────────────────────────┤
```

Phone (< 1024px): one column. Header 56px with the wordmark; **bottom tab bar** (64px) for Planner/Hedging; a **sticky summary bar** ("USD 15,000 by 1 Aug 2027", Edit) appears under the header once the converter scrolls out of view. The converter sentence wraps deliberately: amount + currency on line one, "by [date]" on line two.

Alignment: everything left-aligned except numbers in comparisons, which are right-aligned.

## 3. Colour

All colours are CSS variables on `:root`, with a dark set under `@media (prefers-color-scheme: dark)`. Dark values are their own steps, not inversions.

| Token                  | Light     | Dark      | Use                                                                                   |
| ---------------------- | --------- | --------- | ------------------------------------------------------------------------------------- |
| `--background`         | `#F4F6FA` | `#0A1020` | Page                                                                                  |
| `--card` / `--popover` | `#FFFFFF` | `#111A2E` | Panels, popovers                                                                      |
| `--sunken`             | `#EEF2F8` | `#0D1526` | Table header row, inset areas                                                         |
| `--border`             | `#D9E0EC` | `#25314B` | Dividers, panel borders                                                               |
| `--input`              | `#7C8AA6` | `#5A6886` | Input and control outlines (≥ 3:1)                                                    |
| `--foreground`         | `#0B1B3F` | `#E9EEF8` | Body text                                                                             |
| `--muted-foreground`   | `#4B5875` | `#A6B1C8` | Secondary text                                                                        |
| `--heading`            | `#0A2463` | `#FFFFFF` | Headings, wordmark                                                                    |
| `--navy`               | `#0A2463` | `#0F1E45` | Footer, wordmark tile                                                                 |
| `--primary`            | `#1A56DB` | `#6B9BFF` | Primary button, links, focus, sliders                                                 |
| `--primary-foreground` | `#FFFFFF` | `#06102A` | Text on primary                                                                       |
| `--link`               | `#1A56DB` | `#8AB0FF` | Links, secondary button text                                                          |
| `--highlight`          | `#FFC52B` | `#FFD24D` | The today's-cost mark and the active-tab bar. Nothing else. Never text, never buttons |
| `--destructive`        | `#B42318` | `#FF8A80` | Errors                                                                                |
| `--ring`               | `#1A56DB` | `#8AB0FF` | Focus ring                                                                            |

Contrast (WCAG 2.2, computed): body text 15.6–16.9:1 light, 14.9–16.3:1 dark; muted text 6.6–7.1:1 / 8.1–8.8:1; links and secondary-button text 5.6:1 / 7.4:1; primary-button label 5.6:1 / 6.6:1; error text ≥ 6.1:1; input borders 3.48:1 / 3.10:1; focus ring ≥ 3:1. The yellow active-tab bar (1.58:1) is decorative: the active tab is also bold, navy, and `aria-current="page"`.

## 4. Type

Two families, self-hosted with `next/font` (downloaded at build time, served from `/_next/static/media`; CSP stays `font-src 'self'`).

| Role                              | Family            | Weight | Size / line height | Phone   |
| --------------------------------- | ----------------- | ------ | ------------------ | ------- |
| Today's-cost figure               | Plus Jakarta Sans | 800    | 48 / 56            | 40 / 48 |
| Page title (h1)                   | Plus Jakarta Sans | 800    | 28 / 36            | 24 / 32 |
| Panel / section title (h2)        | Plus Jakarta Sans | 700    | 20 / 28            | 20 / 28 |
| Converter sentence                | Plus Jakarta Sans | 700    | 22 / 32            | 20 / 28 |
| Body                              | IBM Plex Sans     | 400    | 16 / 24            | 16 / 24 |
| UI labels, buttons, table headers | IBM Plex Sans     | 600    | 14–16 / 20–24      | same    |
| Small / helper                    | IBM Plex Sans     | 400    | 14 / 20            | same    |
| Caption, axis labels              | IBM Plex Sans     | 500    | 12 / 16            | same    |

Weights shipped: Jakarta 700, 800; Plex 400, 500, 600. Every number, rate and amount uses `font-variant-numeric: tabular-nums` (utility `tabular-nums`). Line length ≤ 75 characters for prose. Sentence case everywhere; no all-caps.

## 5. Spacing, radii, shadows

- **Spacing (8px grid):** 8, 16, 24, 32, 40, 48, 64. 4px only between an icon and its label.
- **Page gutters:** 16px phone, 24px tablet, 32px desktop. Panels: 24px padding (phone 16px). Space between major sections: 48px.
- **Radii:** inputs and buttons 10px; panels 16px; tooltips 8px; avatars/flags round. Nothing else is rounded.
- **Shadow:** only the converter panel: `0 1px 2px rgb(10 36 99 / 6%), 0 8px 24px rgb(10 36 99 / 8%)` (dark: `0 1px 2px rgb(0 0 0 / 40%), 0 8px 24px rgb(0 0 0 / 35%)`). The results panel has a border, no shadow. No other shadows.
- **Tap targets:** ≥ 44×44px for every control; converter fields 52–56px tall.

## 6. Charts

One entity keeps one colour on every page. Legends stay, plus direct labels and marker shapes, so colour is never the only signal.

| Slot | Light     | Dark      | Planner             | Hedging     |
| ---- | --------- | --------- | ------------------- | ----------- |
| 1    | `#1A56DB` | `#4A86F0` | All at once         | Forward     |
| 2    | `#E8590C` | `#E5641F` | Equal tranches      | Call option |
| 3    | `#0F9D8A` | `#12A388` | Wait until deadline | Unhedged    |
| 4    | `#7A4CC2` | `#8F6EE6` | Target rate         | –           |

Validated with the data-viz palette validator in both modes (lightness band, chroma, colour-blind separation worst ΔE 14.8 / 13.5, ≥ 3:1 against the panel). Gridlines use `--border`; axis labels 12px `--muted-foreground`; tick decimals come from the tick spacing (`lib/ticks.ts`). Yellow is never a series colour.

## 7. Components

| Component                              | Rules                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Header**                             | White (dark: `--card`), 64px desktop / 56px phone, bottom border. Wordmark: navy tile with two exchange arrows + "SpotCheck" in Jakarta 800. Tabs "Planner", "Hedging": active = navy bold + 3px yellow bar + `aria-current`. On phones the tabs move to the bottom tab bar. Header right: "Not financial advice" (desktop only). |
| **Bottom tab bar** (phone)             | Fixed, 64px, two equal targets with icon + label. Safe-area padding.                                                                                                                                                                                                                                                              |
| **Page title row**                     | h1 + one sentence. No eyebrow, no badge. On Hedging, the scenario chips sit directly under it.                                                                                                                                                                                                                                    |
| **Converter panel**                    | Sentence: "I need [amount] [currency] by [date]". Then "Converting today" label, the **today's-cost figure** (amount × latest rate × (1 + spread), identical to the "All at once" result) with the yellow mark, and under it "S$X at mid rate, before your Y% spread". Then a divider and **More options**.                       |
| **Currency picker**                    | Button showing flag + code; opens a listbox with a search field. Matches code, currency name and country name ("Japan" → JPY, "Korea" → KRW, "Germany" → EUR). Popular first: USD, GBP, EUR, AUD, CAD, KRW, JPY; then the rest A–Z. Arrow keys, Enter, Esc, type-to-filter. Flags appear only here, as content.                   |
| **More options**                       | Disclosure. Closed, it summarises current values in one comma-separated line. Open: conversions, start date, spread, target, each with a visible label and helper text. Closed by default.                                                                                                                                        |
| **Sticky summary bar** (phone)         | Appears when the converter leaves the viewport; "USD 15,000 by 1 Aug 2027" and an Edit button that scrolls back.                                                                                                                                                                                                                  |
| **Results panel**                      | Title, source label, then the two actions in a fixed place: **Copy link** (primary) and **Download Excel** (secondary; exports the window selected in "Look at one window"). Then the range chart, the comparison table, and the summary. Fixed minimum height with a skeleton while loading (no layout shift).                   |
| **Comparison table**                   | One row per strategy; columns Median, Middle 90% (low–high), Worst case. Right-aligned tabular numbers, row dividers, header row on `--sunken`. A colour key beside each name. No row is styled differently.                                                                                                                      |
| **Sections** (one window, methodology) | Open sections on the page background with a top rule and an h2. Not cards.                                                                                                                                                                                                                                                        |
| **Hedging**                            | Same header and title row, scenario chips under the title. Panels: "What a forward locks in", "What an option would cost", "How the option responds", "How each hedge would have worked out". Values are label/value rows, not tiles.                                                                                             |
| **Help tips**                          | A 24px "i" button (44px hit area) next to forward points, premium, delta, gamma, vega and theta. Opens a short "What is this?" popover on click or focus; Esc closes; `aria-describedby`.                                                                                                                                         |
| **Buttons**                            | Exactly two styles. Primary: `--primary` fill, `--primary-foreground` text. Secondary: transparent with `--link` text and a 1.5px `--primary` border. 44px min height, 10px radius. One primary per panel.                                                                                                                        |
| **Focus**                              | 3px `--ring` outline with 2px offset on every focusable element.                                                                                                                                                                                                                                                                  |
| **Icons**                              | lucide-react only, 18–20px, stroke 2. Used for: link, download, chevrons, info, and the two bottom-tab icons.                                                                                                                                                                                                                     |
| **Footer**                             | Navy (`--navy`), white disclaimer, attribution as a plain list. Wording of the disclaimer and attribution never changes.                                                                                                                                                                                                          |
| **Favicon / touch icon**               | The wordmark tile (`app/icon.svg`, `public/apple-touch-icon.png`).                                                                                                                                                                                                                                                                |

## 8. Motion

Only in answer to an action: the More options disclosure and the currency list open with a 150ms fade/slide; respect `prefers-reduced-motion`. No entrance animations.

## 9. History

The proposal (two directions, mockups) is kept in `docs/design/mockups/`. Screenshot-loop rounds for each redesign PR go in `docs/design/rounds/`.
