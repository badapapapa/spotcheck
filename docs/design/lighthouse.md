# Lighthouse (mobile)

Lighthouse 12.8.2, mobile form factor, simulated throttling (the default),
headless Chromium, against the static build served with compression by
`scripts/serve-out.ts`. Three runs per page on the final build of this
branch, 31 Oct 2026.

| Page    | Run | Performance | Accessibility | Best practices | SEO | FCP   | LCP   | TBT    | CLS |
| ------- | --- | ----------- | ------------- | -------------- | --- | ----- | ----- | ------ | --- |
| Planner | 1   | 90          | 100           | 100            | 100 | 1.1 s | 3.0 s | 230 ms | 0   |
| Planner | 2   | 91          | 100           | 100            | 100 | 1.1 s | 3.2 s | 180 ms | 0   |
| Planner | 3   | 91          | 100           | 100            | 100 | 1.1 s | 3.2 s | 170 ms | 0   |
| Hedging | 1   | 91          | 100           | 100            | 100 | 1.1 s | 3.2 s | 170 ms | 0   |
| Hedging | 2   | 91          | 100           | 100            | 100 | 1.1 s | 3.2 s | 180 ms | 0   |
| Hedging | 3   | 92          | 100           | 100            | 100 | 1.1 s | 3.0 s | 170 ms | 0   |

For comparison, one run of the `main` build under the same conditions:
Planner 93 / 100, Hedging 93 / 100 (performance / accessibility).

Performance sits just above the 90 target, a point or two below `main`. The
remaining gap is the larger first-load script (the planner's own chunk is
146 KB against main's 161 KB, but shared chunks grew slightly) and the second
font family. `docs/design/rounds/README.md` (round 3) lists what was changed
to get here from 81–84 (Planner) and 59–60 (Hedging).

Extra checks run alongside, at 390×844 and 1366×768, light and dark, both
pages:

- **axe-core (WCAG 2.0–2.2 A/AA):** no violations, including colour contrast in dark mode, which Lighthouse doesn't test.
- **Tap targets:** every visible button, link, input and summary is at least 44×44px. The only exception is Base UI's 1×1 hidden form input, which isn't a control.
- **Button styles:** the action buttons use exactly `.btn-primary` and `.btn-secondary`, with one primary per page (Copy link). Hedging has none.
- **Layout shift:** CLS 0 on both pages, and a Playwright layout-shift observer recorded no shifts on the Planner and one of 0.0004 on Hedging.
