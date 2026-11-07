# PR G: clarity

- [`plan.md`](plan.md): what was checked on `main` first, and the plan.
- `before/`: `main` at `edfa8fd` (PR F merged), built locally, at 375×812 (2× pixels, touch) and 1440×900, light and dark.
- `after/`: this branch, on the same data, with the same filenames.
- [`compare.md`](compare.md): before and after, and the checks.

Captured with [`scripts/design-shots.ts`](../../../scripts/design-shots.ts). State names are listed in [Round D's README](../round-d/README.md#states); this PR adds the `g-*` states:

- `g-glance`;
- `g-period`, with a conversion moved off Sat 21 Mar 2026;
- `g-timeline-1y`;
- `g-invalid-glance`;
- `g-huge-comparison`, EUR 1e12;
- `g-hedging-jpy`;
- `g-hedging-notice`;
- `g-about`.

```bash
WIDTHS=375,1440 node scripts/design-shots.ts http://localhost:4175 docs/design/pr-g/after
```
