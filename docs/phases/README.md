# Build log by phase

Each folder says what was built for that part of the plan, the test results, the decisions to review, and the [BEN] steps. Each phase was built on its own branch, reviewed, and merged into `main` with a merge commit (linked below). The phase branches no longer exist.

| Weeks        | Phase                 | Folder                                                         | Merged into `main`                                                                            |
| ------------ | --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1            | 0 · Setup             | [week-01-setup](week-01-setup/README.md)                       | [`b1aa444`](https://github.com/badapapapa/spotcheck/commit/b1aa444) (first commits on `main`) |
| 2–3          | 1 · Data pipeline     | [week-02-03-data-pipeline](week-02-03-data-pipeline/README.md) | [`d1c2fe0`](https://github.com/badapapapa/spotcheck/commit/d1c2fe0)                           |
| 4–5          | 2 · Engine            | [week-04-05-engine](week-04-05-engine/README.md)               | [`6afe3b5`](https://github.com/badapapapa/spotcheck/commit/6afe3b5)                           |
| 6–7          | 3 · Planner MVP       | [week-06-07-planner](week-06-07-planner/README.md)             | [`82f1f60`](https://github.com/badapapapa/spotcheck/commit/82f1f60)                           |
| 8–9          | 4 · Hedging tab       | [week-08-09-advanced](week-08-09-advanced/README.md)           | [`a4e3f70`](https://github.com/badapapapa/spotcheck/commit/a4e3f70)                           |
| 10           | 5 · Polish and launch | [week-10-polish](week-10-polish/README.md)                     | [`2387e0b`](https://github.com/badapapapa/spotcheck/commit/2387e0b)                           |
| after launch | ECB source            | [ecb-source](ecb-source/README.md)                             | [`e7ea9eb`](https://github.com/badapapapa/spotcheck/commit/e7ea9eb)                           |

| after launch | ECB source | [ecb-source](ecb-source/README.md) | `ecb-source` | new PR |

All phases were merged in order on 17 Oct 2026 and the ECB change on 19 Oct 2026.

## Gotcha: the lockfile

`npm install <package>` on macOS (npm 11) can drop `@emnapi/core` and `@emnapi/runtime` (Linux-only optional dependencies) from `package-lock.json`, and then `npm ci` fails in CI. If that happens, regenerate the lockfile from scratch:

```bash
rm -rf node_modules package-lock.json && npm install
```
