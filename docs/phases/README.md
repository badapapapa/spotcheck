# Build log by phase

Each folder says what was built for that part of the plan, the test results, the decisions to review, and the [BEN] steps. Each phase was built on its own branch, reviewed, and merged into `main` with a merge commit (linked below). The phase branches no longer exist.

| Weeks        | Phase                 | Folder                                                         | Merged into `main`                                                                            |
| ------------ | --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1            | 0 · Setup             | [week-01-setup](week-01-setup/README.md)                       | [`b1aa444`](https://github.com/badapapapa/spotcheck/commit/b1aa444) (first commits on `main`) |
| 2–3          | 1 · Data pipeline     | [week-02-03-data-pipeline](week-02-03-data-pipeline/README.md) | [`ae4461e`](https://github.com/badapapapa/spotcheck/commit/ae4461e)                           |
| 4–5          | 2 · Engine            | [week-04-05-engine](week-04-05-engine/README.md)               | [`c54cd13`](https://github.com/badapapapa/spotcheck/commit/c54cd13)                           |
| 6–7          | 3 · Planner MVP       | [week-06-07-planner](week-06-07-planner/README.md)             | [`1cc896c`](https://github.com/badapapapa/spotcheck/commit/1cc896c)                           |
| 8–9          | 4 · Hedging tab       | [week-08-09-advanced](week-08-09-advanced/README.md)           | [`c76ed3d`](https://github.com/badapapapa/spotcheck/commit/c76ed3d)                           |
| 10           | 5 · Polish and launch | [week-10-polish](week-10-polish/README.md)                     | [`768a484`](https://github.com/badapapapa/spotcheck/commit/768a484)                           |
| after launch | ECB source            | [ecb-source](ecb-source/README.md)                             | [`973a6c1`](https://github.com/badapapapa/spotcheck/commit/973a6c1)                           |

| after launch | ECB source | [ecb-source](ecb-source/README.md) | `ecb-source` | new PR |

All phases were merged in order on 17 Oct 2026 and the ECB change on 19 Oct 2026.

## Gotcha: the lockfile

`npm install <package>` on macOS (npm 11) can drop `@emnapi/core` and `@emnapi/runtime` (Linux-only optional dependencies) from `package-lock.json`, and then `npm ci` fails in CI. If that happens, regenerate the lockfile from scratch:

```bash
rm -rf node_modules package-lock.json && npm install
```
