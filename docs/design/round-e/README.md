# Round E: converter direction, timeline range, target label

- [`plan.md`](plan.md): the plan and the approved decisions.
- `before/`: `main` at `f739e25` (the Round D merge, as in production), at 375×812 (2× pixels, touch) and 1440×900, light and dark. `planner-options` was captured from production, the rest from a local build of `main`.
- `mockups/`: sketches injected into the built site for the plan, not built code.
- `after/`: the same states and filenames on this branch, plus the timeline at 1Y and 5Y.
- [`compare.md`](compare.md): before and after, and the checks on the final build.

Captured with [`scripts/design-shots.ts`](../../../scripts/design-shots.ts) (state names are listed in [Round D's README](../round-d/README.md#states); this round adds `planner-options`, `planner-timeline-1y` and `planner-timeline-5y`):

```bash
WIDTHS=375,1440 node scripts/design-shots.ts http://localhost:4175 docs/design/round-e/before
```

Only 375 and 1440 were captured this round, so `local/` (git-ignored) stays empty.
