# Data-quality flags: how they are handled

The rules for the nightly data-quality check, decided after the evaluation in `docs/quality/evaluation.md`. The detector (`scripts/quality/`) reads `data/` and never changes it.

## Where it runs

`npm run quality` (`scripts/quality/run.ts`) runs in the `build` job of `fetch-data.yml`, after `npm run fetch-data` and before `npm run check`.

It re-judges the week up to its last check, then judges every day after it. Series publish on different days (the ECB a day after the blended rates), and a day judged again once its next day is known can be confirmed as a spike. A re-judged day replaces its own flag. With no earlier check it judged the last 30 days; that first run raised nothing, once BRL 26 Oct 2026 was reviewed (below).

## What each kind of flag does

| Flag   | Kinds                       | Job                                                                                                      | Shown where                                                                       |
| ------ | --------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Severe | unit, inverted              | **fails**: no artifact, nothing committed, yesterday's data stays live, and GitHub emails the failed run | the failed job's log and summary                                                  |
| Soft   | spike, move, stale, outlier | passes; the data is committed as usual                                                                   | the job summary, `data/quality.json`, the site's footer and the issue (see below) |

While a severe error stays in the source, every night's run fails in the same way until it is reviewed.

## Closing a flag

A flag stays open until it is reviewed; there is no automatic expiry. To close one, add its day to `scripts/fetch/known-anomalies.ts` in a PR:

- **`jump`** if the move is real (a devaluation, a peg change). The detector never raises a listed day again.
- **`upstream-error`** if the source published a bad rate. The pipeline drops the day, so the next run removes it from the site.

At the history's rate that is about 3 or 4 flags a year across all currencies, mostly real events.

## `data/quality.json`

Numbers and fixed values only, with no free text, so every field can be checked: with Zod by the site and `npm run validate-data`, and with jq by the `notify` job.

```json
{
  "checkedThrough": "2026-11-16",
  "open": [
    {
      "currency": "BRL",
      "date": "2026-10-26",
      "kind": "move",
      "severity": "soft",
      "move": -0.0954,
      "z": -20.8,
      "peerZ": -22.8,
      "score": null
    }
  ]
}
```

`move` is the day's move as a fraction. `z` and `peerZ` are its robust z-scores, alone and against its region's peers. `score` is the isolation forest's, for an outlier flag.

## The issue

The `notify` job keeps one issue, "Data quality: open flags", in step with the file: it opens or updates it while flags are open and closes it when none are. It has only `issues: write` and runs no npm or project code. Its only input is the file from the build job. jq keeps only flags with a three-letter code, an ISO date, a known kind and severity, and numeric scores, and the job builds the issue body itself from those fields. A file that isn't the expected shape fails the job and leaves the issue alone.

## Footer

Under "Rates up to …", in the same muted Supporting text:

- no open flags: "Data checks passed"
- open flags: "1 recent rate under review: BRL, 26 Oct 2026", or "2 recent rates under review: BRL, 26 Oct 2026; KZT, 3 Nov 2026"
