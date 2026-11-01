# Round E: converter direction, timeline range, target label

- [`plan.md`](plan.md): the plan and the decisions needed.
- `before/`: `main` at `f739e25` (the Round D merge, as in production), at 375×812 (2× pixels, touch) and 1440×900, light and dark.
- `mockups/`: sketches injected into the built site for the plan, not built code.
- `after/` and `compare.md`: added at the gate.

Captured with [`scripts/design-shots.ts`](../../../scripts/design-shots.ts) (state names are listed in [Round D's README](../round-d/README.md#states)):

```bash
WIDTHS=375,1440 node scripts/design-shots.ts http://localhost:4175 docs/design/round-e/before
```

Only 375 and 1440 were captured this round, so `local/` (git-ignored) stays empty.
