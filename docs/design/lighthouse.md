# Lighthouse (mobile)

Lighthouse 12.8.2, mobile form factor, simulated throttling (the default), headless Chromium. Runs are against the static build, served with compression by `scripts/serve-out.ts`. Three runs per page on the final build of the last review round of PR #8, 31 Oct 2026.

| Page         | Run | Performance | Accessibility | Best practices | SEO | FCP   | LCP   | TBT    | CLS |
| ------------ | --- | ----------- | ------------- | -------------- | --- | ----- | ----- | ------ | --- |
| Planner      | 1   | 96          | 100           | 100            | 100 | 0.8 s | 2.6 s | 150 ms | 0   |
| Planner      | 2   | 96          | 100           | 100            | 100 | 0.8 s | 2.6 s | 80 ms  | 0   |
| Planner      | 3   | 96          | 100           | 100            | 100 | 0.8 s | 2.6 s | 90 ms  | 0   |
| Hedging      | 1   | 91          | 100           | 100            | 100 | 0.8 s | 3.2 s | 190 ms | 0   |
| Hedging      | 2   | 91          | 100           | 100            | 100 | 0.8 s | 3.2 s | 190 ms | 0   |
| Hedging      | 3   | 91          | 100           | 100            | 100 | 0.8 s | 3.2 s | 190 ms | 0   |
| How it works | 1   | 98          | 100           | 100            | 100 | 0.8 s | 2.5 s | 30 ms  | 0   |
| How it works | 2   | 98          | 100           | 100            | 100 | 0.8 s | 2.5 s | 20 ms  | 0   |
| How it works | 3   | 98          | 100           | 100            | 100 | 0.8 s | 2.5 s | 20 ms  | 0   |

For comparison, `main` (the live site) scores 93 on both of its pages under the same conditions.

On every page the largest paint is static text: the question on the Planner, the lede on Hedging and How it works. It paints at about 0.75s on a throttled phone, before any script runs. The interactive parts load around it, into placeholders of their measured size.

What keeps it there:

- **Fonts:** one static weight of Newsreader, preloaded, plus IBM Plex Sans.
- **Placeholder heights:** measured at ten widths from 360 to 1600px.
- **Lazy loading:** the combobox, help-tip popovers, outcome timeline and period detail load just after the page. The period detail is the one that pulls in the chart library.
- **No prefetching** from in-page links.

Under the throttled trace used in `rounds-d/README.md` (412px phone, slow 4G, 4× CPU), all three pages record no layout shifts at all. That includes How it works, where IBM Plex Sans used to swap in late and re-wrap a paragraph; it now uses `display: optional`.

Extra checks, at 390×844 and 1366×768, light and dark, on all three pages:

- **axe-core (WCAG 2.0–2.2 A/AA):** no violations in any of the 12 combinations, including dark-mode contrast.
- **Tap targets:** every visible button, link, input and summary is at least 44×44px. The only exception is Base UI's 1×1 hidden form input, which isn't a control.
- **Horizontal scroll:** none.
