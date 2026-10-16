# SpotCheck

See how converting your exchange money would have played out.

SpotCheck is a free, static web app for students going on exchange. Enter how much foreign currency you need and by when, and it replays different ways of converting SGD (all at once, in tranches, at the deadline, or at a target rate) over every comparable historical window. An advanced tab shows what forward and option hedges would have cost.

It is an educational tool using historical mid-market rates. It is not financial advice, and past rates don't predict future ones.

> Status: under construction (Phase 0, setup). Live link coming soon.

## Development

Requires Node.js 22 or later.

```bash
npm install
npm run dev     # local dev server
npm run check   # type-check, lint, tests
npm run build   # static export to out/
```

## Data sources

- Exchange rates: [Frankfurter](https://frankfurter.dev/)
- SGD interest rates (SORA): [Monetary Authority of Singapore](https://www.mas.gov.sg/)
- USD interest rates: [FRED](https://fred.stlouisfed.org/)

See `SPOTCHECK_PLAN.md` for the build plan and `CLAUDE.md` for project rules.
