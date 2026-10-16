# SpotCheck — Build Plan for Claude Code

Read `CLAUDE.md` first; its rules apply throughout. Work through the phases in order. **Stop at every gate**, report, and wait for Ben's go-ahead.

Steps marked **[BEN]** are manual steps only Ben can do (accounts, secrets, dashboards). When you reach one, tell Ben exactly what to do and wait.

---

## 0. Product summary

**Users.** Students at NUS, NTU and SMU who need a known amount of foreign currency by a known date, e.g. USD 15,000 by 1 Aug 2027.

**Planner (main page).**
- Inputs: currency, amount needed, start date (default today), deadline, max number of conversions, conversion spread %.
- Replays four strategies over every comparable historical window and shows the distribution of SGD cost.

**Advanced tab.**
- For the same scenario: today's forward rate, forward points and carry.
- An option hedge priced with Garman-Kohlhagen, with a strike slider and Greeks charts.
- Historical comparison of unhedged vs forward-hedged (and later option-hedged) cost.

**Stack.** Next.js (App Router, `output: 'export'`), TypeScript strict, Tailwind CSS, shadcn/ui, Recharts, Zod, ExcelJS, Vitest, Playwright (later), GitHub Actions, Cloudflare Pages, Cloudflare Web Analytics. Use the latest stable versions at setup time and pin them in the lockfile.

**Currencies.** 40 currencies used by NUS/NTU/SMU exchange destinations (list in §2.4). The MVP needs only USD fully working end to end; the rest are added in Phase 5.

---

## 1. Repository layout (target)

```
spotcheck/
├── .github/workflows/
│   ├── ci.yml              # type-check, lint, test, gitleaks on push + PR
│   └── fetch-data.yml      # daily cron: fetch → validate → commit data
├── data/
│   ├── fx/SGD-USD.json     # one file per currency (SGD per 1 unit)
│   ├── rates/SORA.json     # daily SORA, decimals
│   ├── rates/USD-DFF.json  # daily effective fed funds rate, decimals
│   └── meta.json           # last-updated dates per series, source attribution
├── scripts/fetch/
│   ├── frankfurter.ts
│   ├── mas.ts
│   ├── fred.ts
│   ├── schemas.ts          # Zod schemas + sanity checks
│   └── run.ts              # entry point: fetch all, validate, write
├── engine/
│   ├── types.ts
│   ├── calendar.ts         # business-day helpers, next-available-rate lookup
│   ├── strategies.ts
│   ├── replay.ts
│   ├── stats.ts            # percentiles, realised volatility
│   ├── rates.ts            # SORA compounding, rate lookups
│   ├── forwards.ts
│   ├── options.ts          # Garman-Kohlhagen, Greeks, normal CDF
│   └── __tests__/
├── app/
│   ├── layout.tsx          # disclaimer footer on every page
│   ├── page.tsx            # planner
│   ├── advanced/page.tsx
│   └── components/
├── lib/url-state.ts        # scenario <-> URL query string
├── notebooks/crosscheck.ipynb
├── .env.example            # FRED_API_KEY= (empty)
├── .gitignore              # includes .env, out/, node_modules/
├── CLAUDE.md
├── SPOTCHECK_PLAN.md
└── README.md
```

---

## 2. Data specification

### 2.1 FX rates: Frankfurter (no key)
- Base URL: `https://api.frankfurter.dev/v2/`
- Time series: `GET /v2/rates?base=sgd&quotes=usd,eur,...&from=YYYY-MM-DD&to=YYYY-MM-DD`
- Returns an array of `{date, base, quote, rate}` where `rate` = foreign units per 1 SGD. Some rows can carry the previous day's date. Keep the date as given.
- **Invert once at ingestion**: store `sgdPerUnit = 1 / rate`. Store both raw and inverted values in the JSON so the inversion is auditable.
- Use the default blended rates. Record "Frankfurter (blended central-bank mid rates)" in `meta.json`. Caching locally is permitted and encouraged by the provider.
- History: request from the earliest date available per currency (try 1999-01-04). Large ranges may need chunking by year. Check the docs for NDJSON if responses are large.
- Brunei dollar (BND) is pegged 1:1 to SGD, so store it as a constant series and flag it in the UI. Ecuador uses USD.

### 2.2 SGD interest rate: daily SORA (MAS)
- **Decision (final):** daily SORA is the base series, from 1 Jul 2005. Compound it in-house. Use MAS's **published compounded SORA (1M/3M/6M)** only as a back-check, from 6 Aug 2020 onward.
- Source: MAS publishes SORA via its statistics pages and APIs (MAS API datasets are free). **First task in Phase 1:** find the current official MAS endpoint or download for (a) daily SORA history and (b) published compounded SORA 1M/3M/6M. Report the URLs to Ben before writing the fetcher.
- If no stable API exists for the full history: Ben downloads the historical CSV from the MAS website once **[BEN]**, commit it as `data/seed/sora-history.csv`, and the daily job appends new days from whichever MAS endpoint exists.
- Store as decimals. SORA is published by 9am on the next Singapore business day, so schedule the cron accordingly (see §2.5).

### 2.3 USD interest rate: FRED (free key)
- Series: `DFF` (effective federal funds rate, daily, long history) as the USD overnight leg to pair with SORA. Optionally store `SOFR` (starts 2018) for display only.
- Endpoint: `https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=$FRED_API_KEY&file_type=json&observation_start=2005-01-01`
- FRED marks missing values as `"."`. Map them to "no observation", not zero.
- **[BEN]** Create a free FRED API key at fredaccount.stlouisfed.org and add it as the GitHub Actions secret `FRED_API_KEY`. Locally, put it in `.env` (gitignored). The key must never appear in the frontend, logs or commits.

### 2.4 Currency list (40)
USD, CAD, MXN, BRL, ARS, CLP, COP, PEN, CNY, HKD, MOP, JPY, KRW, TWD, INR, IDR, MYR, PHP, THB, VND, BND, KZT, ILS, SAR, TRY, MAD, ZAR, AUD, NZD, EUR, CZK, DKK, HUF, ISK, NOK, PLN, RUB, SEK, CHF, GBP.

Put this list in one config file, `engine/currencies.ts`, with display name, flag emoji, and whether forward/option pricing is supported. In the MVP only USD supports forwards and options; other currencies show the planner only.

### 2.5 Daily data job (`fetch-data.yml`)
- Cron: 03:00 UTC daily (11:00 SGT, after SORA publishes). Also allow manual dispatch.
- Steps:
  1. Install dependencies.
  2. Run `npm run fetch-data`.
  3. Validate every file with Zod plus sanity checks:
     - dates strictly ascending
     - no gap longer than 7 calendar days (except known holiday clusters; log them as warnings)
     - FX within ±30% of the previous observation
     - rates between −1% and 25%
  4. If anything fails, exit non-zero and commit nothing.
  5. If data changed, commit with message `data: update YYYY-MM-DD` using the GitHub Actions bot identity.
- Fetch only new days by reading the last date in each file. Make the fetch idempotent.
- `meta.json` records the last date per series and the source attribution strings shown in the UI footer.

---

## 3. Engine specification (`engine/`)

### 3.1 Types
```ts
type ISODate = string;                          // 'YYYY-MM-DD'
type Series = { dates: ISODate[]; values: number[] }; // ascending, same length
type Scenario = {
  currency: string;          // e.g. 'USD'
  amount: number;            // foreign units needed
  startDate: ISODate;
  deadline: ISODate;
  tranches: number;          // >= 1
  spread: number;            // decimal, e.g. 0.005
  targetRate?: number;       // SGD per unit, for the target strategy
};
type StrategyId = 'lumpSum' | 'tranches' | 'wait' | 'target';
type Conversion = { date: ISODate; units: number; rate: number; sgd: number };
type StrategyResult = { strategy: StrategyId; conversions: Conversion[]; totalSgd: number };
```

### 3.2 Calendar
- `rateOn(series, date)` returns the value on `date`, or the next available date's value if there's none (weekends and holidays).
- `rateAsOf(series, date)` returns the latest value **on or before** `date`. Use this for any decision information, so there is no look-ahead.
- Tranche dates are spaced evenly in calendar days from start to deadline inclusive, each snapped forward with `rateOn`.

### 3.3 Strategies (each returns a `StrategyResult`; cost includes spread: `sgd = units × rate × (1 + spread)`)
- `lumpSum`: all units on `startDate`.
- `tranches`: `amount / k` units on each of `k` evenly spaced dates. `k = 1` must equal `lumpSum`.
- `wait`: all units on `deadline`.
- `target`: all units on the first date where `rate <= targetRate`; otherwise on `deadline`. The decision uses only that day's rate.

### 3.4 Historical replay (`replay.ts`)
- Window length `L` = calendar days from scenario start to deadline.
- For every historical start date `d` (each trading day) with `d + L` still inside the data, run all strategies on the shifted scenario. `targetRate` is set relative to the spot on `d` (e.g. "2% better than spot") so it is comparable across history.
- Output per strategy: an array of `totalSgd`, plus summary stats from `stats.ts`:
  - median, 5th and 95th percentiles, min, max
  - share of windows where it beat `lumpSum`
- Normalise costs to "SGD per 1,000 foreign units" for cross-window comparison, then rescale to the user's amount for display.
- Performance budget: under 300 ms for 20 years of daily USD data in the browser. If slower, run it in a Web Worker. Measure before optimising.

### 3.5 SORA compounding (`rates.ts`)
- `compoundedRate(series, from, to)` uses the MAS method, with `r_i` = SORA on business day `i`, `n_i` = calendar days it applies (Fridays usually 3), and `N` = total calendar days:
  - `r = (Π(1 + r_i × n_i / 365) − 1) × 365 / N`
- **Back-check test:** fetch a sample of MAS's published 1M/3M/6M compounded SORA values (at least 20 dates since Aug 2020) into `engine/__tests__/fixtures/compounded-sora.json`. Assert your function reproduces them to within 0.0001 (1 basis point). Document any convention differences you find, such as the observation-shift or lookback that MAS uses. This test is a Phase 2 gate.

### 3.6 Forwards (`forwards.ts`)
- Covered interest parity with simple interest for T ≤ 1 year: `F = S0 × (1 + r_d × T) / (1 + r_f × T)`, with `r_d` = SGD rate and `r_f` = foreign rate.
- For historical forward hedges starting on date `d`:
  - `r_d` = compounded SORA over the window **ending on `d`**, with the same tenor as the hedge (backward-looking proxy).
  - `r_f` = DFF compounded the same way.
  - Document in a code comment and the methodology page that this is an approximation of term rates.
- Forward hedge cost = `amount × F × (1 + spread)`, fixed on day `d`.

### 3.7 Options (`options.ts`)
- Garman-Kohlhagen call on the foreign currency, quoted in SGD per unit:
  - `C = S0·e^(−r_f T)·N(d1) − K·e^(−r_d T)·N(d2)`
  - `d1 = [ln(S0/K) + (r_d − r_f + σ²/2)T] / (σ√T)`, `d2 = d1 − σ√T`
- Use continuously compounded equivalents of the rates: `ln(1 + r × T) / T`.
- Greeks: delta, gamma, vega, theta (closed forms). Test each against central finite differences.
- Normal CDF: implement a high-accuracy approximation (e.g. based on the error function, accurate to about 1e-7) and test it against known values.
- σ = annualised realised volatility of daily log returns over the trailing 60 or 90 trading days **before** the pricing date (selectable). The user can override it. Label it "realised volatility (proxy for implied)".
- Hedged cost on deadline = `premium × amount + amount × min(S_T, K) × (1 + spread)`, where the premium is paid on the start date (ignore the time value of the premium in the MVP and note it).

### 3.8 Required tests (Vitest)
- **Inversion:** a Frankfurter rate of 0.78015 maps to 1.28180 SGD per USD (to 5 dp).
- **Strategies:**
  - On a flat-rate series, all four strategies cost the same.
  - `tranches(k=1)` equals `lumpSum`.
  - Costs scale linearly with amount.
- **Look-ahead guard:** altering all data after day `d` must not change any decision made on or before `d`.
- **Calendar:** weekend and holiday snapping; a missing deadline rate snaps forward.
- **Compounding:** the MAS back-check fixtures pass (above).
- **Forwards:** `r_d = r_f` gives `F = S0`; higher `r_d` gives `F > S0`.
- **Options:**
  - Put-call parity holds to 1e-10.
  - Price is increasing in σ and in S0.
  - 0 < delta < e^(−r_f T).
  - Reference value: S0=1.60, K=1.60, r_d=0.08, r_f=0.11 (continuously compounded), σ=0.20, T=0.5 gives C ≈ 0.07505 (independently computed; confirm against the notebook).
- **Stats:** percentiles match a hand-computed small array.
- **Cross-check:** `notebooks/crosscheck.ipynb` reimplements the GK price and Greeks with scipy for 20 random inputs and writes `engine/__tests__/fixtures/gk-crosscheck.json`. The TS test compares results to 1e-6.

---

## 4. UI specification

### Global
- Header "SpotCheck" with a one-line tagline: "See how converting your exchange money would have played out."
- Footer on every page:
  - Disclaimer: "Educational tool using historical mid-market rates. Not financial advice. Past rates don't predict future ones."
  - Data attribution from `meta.json` and the last-updated date.
- Light and dark mode. Mobile-first: most users will open it from a Telegram link on their phone.
- Accessibility: labels on every input, keyboard navigable, colour never the only signal, charts with text summaries.

### Planner (`/`)
- Form with sensible defaults: USD 15,000, 6 tranches, 0.5% spread. Show a currency picker with flags.
- Results:
  1. **Distribution chart:** one row per strategy showing median plus a 5th–95th percentile whisker, in SGD. Build it with Recharts or custom SVG.
  2. **Plain-English summary,** generated from the stats and never advisory. For example: "In this history, spreading over 6 conversions narrowed the worst case by S$X compared with converting at once, while the median cost was within S$Y."
  3. **Sample path:** pick a historical start date (slider) and show the rate line with conversion markers for each strategy.
  4. **Methodology** expandable section explaining the replay, overlapping windows, and mid-market vs real rates.
- The entire scenario round-trips through the URL (`lib/url-state.ts`), with a "Copy link" button.

### Advanced (`/advanced`)
- The scenario carries over via URL.
- Panel 1, today's forward:
  - spot, forward rate, forward points
  - SGD and USD rates used, with their dates
  - the carry in SGD for the user's amount
- Panel 2, option pricer:
  - strike slider (80–120% of spot), σ input (defaulting to realised)
  - premium in SGD and as % of notional
  - payoff-at-expiry chart
  - Greeks vs spot charts, which update live
- Panel 3, history: unhedged vs forward-hedged cost distributions on one chart (option-hedged added in Phase 5).
- Show a USD-only notice for currencies without rate data.

### Excel export (Phase 5)
- ExcelJS workbook with a Scenario sheet (inputs), a Rates sheet (the window's daily rates), and a Strategies sheet whose cost cells are **live formulas** referencing the Rates sheet, so users can audit the maths.

---

## 5. Phases and gates

### Phase 0: Setup (week 1)
- **[BEN]** Create an empty GitHub repo `spotcheck` (private to start), and enable secret scanning plus push protection in its settings.
- Scaffold:
  - Next.js with TypeScript strict, Tailwind and shadcn/ui
  - `output: 'export'`
  - ESLint + Prettier
  - Vitest
  - `npm run check`
- Add `.gitignore` (with `.env`), `.env.example`, `CLAUDE.md`, this plan, and a README stub.
- `ci.yml`: Node LTS, `npm ci`, `npm run check`, and the gitleaks action, on push and PR.
- A placeholder home page with the header and disclaimer footer.
- **[BEN]** Connect the repo in the Cloudflare Pages dashboard: build `npm run build`, output `out`. Enable Cloudflare Web Analytics.
- **Gate 0:** CI green; site live on `*.pages.dev`; gitleaks running. Report the URL.

### Phase 1: Data pipeline (weeks 2–3)
- Find and report the MAS SORA endpoints (§2.2) **before coding the MAS fetcher**.
- Implement the fetchers, Zod schemas, sanity checks, `run.ts`, and the backfill of full history.
- `fetch-data.yml` with cron plus manual dispatch.
- **[BEN]** Add `FRED_API_KEY` to GitHub Actions secrets.
- **Gate 1:** history files committed for USD, SORA and DFF; the daily job has run successfully for 7 consecutive days without intervention; a deliberately corrupted test file is rejected by validation. Report file sizes and date ranges.

### Phase 2: Engine (weeks 4–5)
- Implement §3.1–3.6 and the stats, with all tests from §3.8 except options.
- Build `notebooks/crosscheck.ipynb` for the compounding and strategy values.
- **Gate 2:** all tests pass, including the **MAS compounded-SORA back-check**. Report any convention mismatch and how it was resolved.

### Phase 3: Planner MVP (weeks 6–7)
- Build the planner UI (§4) for USD, plus URL state, methodology, and mobile layout.
- Smoke test: Playwright test that loads `/`, submits defaults, and sees the chart.
- **Gate 3:** live on Cloudflare Pages; Ben has had 5 exchange students try it **[BEN]**; collect feedback into `docs/feedback.md` and propose changes.

### Phase 4: Advanced tab (weeks 8–9)
- Options engine (§3.7) and its tests, plus the advanced UI panels 1–3.
- **Gate 4:** GK cross-check passes to 1e-6; Greeks finite-difference tests pass. **[BEN]** confirms the employer outside-activity policy check is done before public launch.

### Phase 5: Polish and launch (week 10)
- Add the other 39 currencies to the planner, Excel export, option-hedged history, and Lighthouse ≥ 90 on mobile.
- README:
  - screenshot, live link, one-line pitch
  - "How the engine works" with the formulas
  - testing approach, data sources and attribution
- `docs/case-study.md` draft covering the problem, the maths, the look-ahead decision, the SORA back-check, and lessons learned.
- Make the repo public **[BEN decides]**.
- **Gate 5:** public launch.

### After launch
- Add features only from real user feedback. No accounts, no paid services, no monetisation.

---

## 6. Definition of done (every phase)
- `npm run check` passes locally and in CI.
- No secrets in the diff (gitleaks clean).
- New code has tests; engine coverage stays ≥ 90%.
- The UI has no advisory wording, and the disclaimer is visible.
- A short phase summary is reported to Ben: what was built, test output, anything deferred, and the next step.

## 7. How to start
Begin with Phase 0. First, list the **[BEN]** steps Ben needs to do now. Then scaffold the repo and stop at Gate 0.
