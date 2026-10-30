# Lighthouse (mobile)

Lighthouse 12.8.2, mobile form factor, simulated throttling (the default), headless Chromium. Runs are against the static build, served with compression by `scripts/serve-out.ts`. Three runs per page on the final build of the editorial redesign, 31 Oct 2026.

| Page         | Run | Performance | Accessibility | Best practices | SEO | FCP   | LCP   | TBT    | CLS |
| ------------ | --- | ----------- | ------------- | -------------- | --- | ----- | ----- | ------ | --- |
| Planner      | 1   | 92          | 100           | 100            | 100 | 0.8 s | 3.0 s | 190 ms | 0   |
| Planner      | 2   | 93          | 100           | 100            | 100 | 0.8 s | 3.0 s | 140 ms | 0   |
| Planner      | 3   | 93          | 100           | 100            | 100 | 0.8 s | 3.0 s | 140 ms | 0   |
| Hedging      | 1   | 92          | 100           | 100            | 100 | 0.8 s | 3.0 s | 180 ms | 0   |
| Hedging      | 2   | 92          | 100           | 100            | 100 | 0.8 s | 3.0 s | 180 ms | 0   |
| Hedging      | 3   | 92          | 100           | 100            | 100 | 0.8 s | 3.0 s | 180 ms | 0   |
| How it works | 1   | 98          | 100           | 100            | 100 | 0.8 s | 2.3 s | 20 ms  | 0   |
| How it works | 2   | 98          | 100           | 100            | 100 | 0.8 s | 2.3 s | 20 ms  | 0   |
| How it works | 3   | 98          | 100           | 100            | 100 | 0.8 s | 2.3 s | 20 ms  | 0   |

For comparison, under the same conditions:

- **`main` (the live site):** 93 on both pages.
- **Direction A (PR #7):** Planner 90–91, Hedging 91–92.

On every page the largest paint is static text: the question on the Planner, the lede on Hedging and How it works. It paints at about 0.75s on a throttled phone, before any script runs. The interactive parts load around it into placeholders of their measured size, so nothing moves.

What got here (details in `rounds-b/README.md`, round 2):

- **Fonts:** one static weight of Newsreader, preloaded. The variable version with optical sizes was 129 KB on the critical path.
- **Placeholder heights:** measured at ten widths from 360 to 1600px.
- **Progress line:** two lines reserved for its message, so the line never grows mid-load.
- **The progress dot:** animated with `transform`, not `left`.
- **No prefetching:** none of the in-page links prefetch.

Extra checks, at 390×844 and 1366×768, light and dark, on all three pages:

- **axe-core (WCAG 2.0–2.2 A/AA):** no violations in any of the 12 combinations, including dark-mode contrast, which Lighthouse doesn't test.
- **Tap targets:** every visible button, link, input and summary is at least 44×44px. The only exception is Base UI's 1×1 hidden form input, which isn't a control.
- **Button styles:** `.btn-primary` and `.btn-secondary` only. Copy link is the one primary on the Planner; Hedging and How it works have none.
- **Horizontal scroll:** none at any of the ten measured widths.
