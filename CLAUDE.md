# CLAUDE.md — SpotCheck

Standing rules for every Claude Code session in this repo. The step-by-step build plan is in `SPOTCHECK_PLAN.md`.

## What this project is
SpotCheck is a free, static web app for students going on exchange. It replays how different ways of converting SGD into a foreign currency would have played out historically. An advanced tab prices forward and option hedges. It is educational only and a portfolio project, with **no monetisation**.

## Hard rules (never break these)
1. **No secrets in the repo or the frontend bundle.** The only secret is `FRED_API_KEY`. It lives in GitHub Actions secrets and is read only by the data-fetch job. Never hard-code a key, token or credential. Never print one in logs. Never commit `.env`.
2. **No personal data.** No accounts, no databases, no forms that store anything, no cookies. Scenario state lives in the URL only.
3. **No financial advice.** The UI shows historical scenarios and hedge costs only. Never write "best", "recommended", "you should", "buy now" or similar wording. Keep the disclaimer visible on every page.
4. **Employer separation.** Build only from public concepts, public data and new code. Do not reproduce anything resembling the owner's employer's internal tools, code, templates, naming or methods. If a request seems to depend on non-public material, stop and ask.
5. **No paid services.** Only free tiers: GitHub, GitHub Actions, Cloudflare Pages, Frankfurter, MAS, FRED.
6. **Engine purity.** `engine/` is pure TypeScript: no React, no network, no `Date.now()`, no randomness. All inputs are passed in.

## Working style
- Work **one phase at a time** from `SPOTCHECK_PLAN.md`. At each phase's gate, stop, summarise what was done, show test output, and wait for the owner (Ben) to approve before starting the next phase.
- Ask before adding any dependency not listed in the plan.
- Write tests alongside code. A phase is not done until `npm run check` passes (type-check, lint, tests).
- Small, focused commits with clear messages, e.g. `engine: add equal-tranche strategy`.
- When the plan is ambiguous or a data source doesn't behave as described, report it and propose an option. Don't silently improvise.
- Explain non-obvious code in short comments. The owner must be able to explain every module in an interview.

## Conventions
- FX rates are always stored and passed as **SGD per 1 unit of foreign currency**. Frankfurter returns foreign per SGD, so invert at ingestion, once, in one tested function.
- Interest rates are decimals (0.0325, not 3.25). Time is in years, ACT/365.
- Dates are ISO strings `YYYY-MM-DD` in Singapore business-day terms. Never use local-time getters.
- TypeScript strict mode. No `any`. Validate external data with Zod.

## Commands (set up in Phase 0)
- `npm run dev`: local dev server
- `npm run check`: type-check, lint and all tests
- `npm run test`: Vitest only
- `npm run build`: static export to `out/`
- `npm run fetch-data`: run the data fetchers locally (needs `FRED_API_KEY` in a local `.env`)
