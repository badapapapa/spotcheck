# Data-quality flags: proposed handling

A proposal for review. Nothing here is built yet; the detector and its evaluation (`docs/quality/evaluation.md`) change no workflow, data or UI.

## Where it runs

In the `build` job of `fetch-data.yml`, after `npm run fetch-data` and before `npm run check`. It reads `data/` and never changes it.

Each night it judges only recent days:

- the days this run adds, as they arrive;
- the day before them, now that its next day is known.

So it is a spike's reversal that raises a spike flag. The roughly 90 flags across the past 27 years never come back.

## What each kind of flag does

| Flag   | Kinds                       | Job                                                                                                      | Shown where                                              |
| ------ | --------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Severe | unit, inverted              | **fails**: no artifact, nothing committed, yesterday's data stays live, and GitHub emails the failed run | the failed job's log                                     |
| Soft   | spike, move, stale, outlier | passes; the data is committed as usual                                                                   | the job summary, and `data/quality.json` as an open flag |

Severe flags are safe to block on. They never fire on the real history, and the synthetic tests catch unit errors and inversions on the night they arrive. While a severe error stays in the source, every night's run fails in the same way, so it needs a decision, below.

## Closing a flag

A flag is closed by reviewing it and adding an entry to `scripts/fetch/known-anomalies.ts` in a PR, as for the BRL print of 2000:

- **`jump`** if the move is real (a devaluation, a peg change). The detector never raises a listed day again.
- **`upstream-error`** if the source published a bad rate. The pipeline drops the day, so the next run removes it from the site.

Soft flags stay open until reviewed. At the history's rate, that's about 3 or 4 a year across all currencies, mostly real events, so this is a short monthly look rather than a stream of alerts. Letting unreviewed flags expire after 30 days would keep the footer quiet without anyone acting, but it would also hide a real problem, so I don't recommend it.

## `data/quality.json`

Validated with Zod by the site, like the other data files:

```json
{
  "checkedThrough": "2026-11-13",
  "open": [
    {
      "series": "SGD-BRL",
      "date": "2026-10-26",
      "kind": "move",
      "severity": "soft",
      "why": "−9.5% (z -20.8, -22.8 against peers), not taken back"
    }
  ]
}
```

## Footer

Next to "Rates up to 13 Nov 2026":

- no open flags: "Data checks passed."
- open flags: "1 recent rate is being checked (BRL, 26 Oct 2026)." For more than one: "2 recent rates are being checked."

No colour, icon or link: Supporting text in `--muted`, like the line it sits on.

## Decisions for you

1. **Blocking:** fail the job on severe flags only, as above.
2. **The first run:** should it judge the last 30 days? If so, BRL 26 Oct 2026 (−9.5% against flat peers, only partly taken back) opens as the first flag. It may well be real, but only an independent source, such as Banco Central do Brasil's PTAX rate, can say.
3. **Footer wording,** as above.
4. **Expiry:** soft flags stay open until reviewed, with no automatic expiry.
