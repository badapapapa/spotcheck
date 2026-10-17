# Build log by phase

Each folder says what was built for that part of the plan, the test results, the decisions to review, and the [BEN] steps. Each phase is its own branch and pull request, stacked in order, so they can be reviewed and merged one at a time.

| Weeks | Phase                 | Folder                                                         | Branch             | PR     |
| ----- | --------------------- | -------------------------------------------------------------- | ------------------ | ------ |
| 1     | 0 · Setup             | [week-01-setup](week-01-setup/README.md)                       | `main`             | merged |
| 2–3   | 1 · Data pipeline     | [week-02-03-data-pipeline](week-02-03-data-pipeline/README.md) | `phase-1-data`     | #5     |
| 4–5   | 2 · Engine            | [week-04-05-engine](week-04-05-engine/README.md)               | `phase-2-engine`   | #6     |
| 6–7   | 3 · Planner MVP       | [week-06-07-planner](week-06-07-planner/README.md)             | `phase-3-planner`  | #7     |
| 8–9   | 4 · Hedging tab       | [week-08-09-advanced](week-08-09-advanced/README.md)           | `phase-4-advanced` | #8     |
| 10    | 5 · Polish and launch | [week-10-polish](week-10-polish/README.md)                     | `phase-5-polish`   | #9     |

**Merging:** merge #5 into `main` first; GitHub then retargets #6 to `main`, and so on down the stack.

## Gotcha: the lockfile

`npm install <package>` on macOS (npm 11) can drop `@emnapi/core` and `@emnapi/runtime` (Linux-only optional dependencies) from `package-lock.json`, and then `npm ci` fails in CI. If that happens, regenerate the lockfile from scratch:

```bash
rm -rf node_modules package-lock.json && npm install
```
