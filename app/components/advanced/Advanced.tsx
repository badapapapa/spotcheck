"use client";

import { daysBetween, rateAsOf } from "@/engine/calendar.ts";
import { findCurrency, fxSourceLabel } from "@/engine/currencies.ts";
import { priceForward, type RateInputs } from "@/engine/forwards.ts";
import type {
  HedgeId,
  HedgeReplayResult,
  OptionSettings,
} from "@/engine/hedge-replay.ts";
import { gkCall } from "@/engine/options.ts";
import { toContinuous } from "@/engine/rates.ts";
import { realisedVol } from "@/engine/stats.ts";
import type { Series } from "@/engine/types.ts";
import { computeHedges } from "@/lib/compute.ts";
import { hedgeIssue, latestStart, startDateIssue } from "@/lib/coverage.ts";
import { loadFx, loadRate, loadSora } from "@/lib/data.ts";
import { formatDate } from "@/lib/dates.ts";
import {
  formatPercent,
  formatRate,
  formatSgd,
  formatSgdAt,
} from "@/lib/format.ts";
import { HEDGE_STYLE } from "@/lib/hedge-style.ts";
import {
  fixingLabel,
  pastDeadlineNote,
  rescaledTo,
  spotWhen,
  startContext,
  type StartContext,
} from "@/lib/start-context.ts";
import { useLoad } from "@/lib/use-data.ts";
import { usePlannerState } from "@/lib/use-planner-state.ts";
import type { PlannerState } from "@/lib/url-state.ts";
import { Info } from "lucide-react";
import { useCallback } from "react";
import { ComparisonTable } from "../ComparisonTable";
import { HISTORICAL_CONTEXT } from "../Glance";
import { RangeChart } from "../DistributionChart";
import { LoadError } from "../LoadError";
import { ScenarioForm, type DateIssue } from "../ScenarioForm";
import { ForwardPanel } from "./ForwardPanel";
import { OptionPanel } from "./OptionPanel";

type Loaded = { fx: Series; sora: Series; foreign: Series };

export function Advanced() {
  const [state, setState, today] = usePlannerState();
  const { scenario } = state;
  const currency = findCurrency(scenario.currency)!;
  const rateSeries = currency.rateSeries;

  const data = useLoad(
    `adv:${scenario.currency}`,
    async (): Promise<Loaded | null> => {
      if (!rateSeries) return null;
      const [fx, sora, foreign] = await Promise.all([
        loadFx(scenario.currency),
        loadSora(),
        loadRate(rateSeries),
      ]);
      return { fx, sora, foreign };
    },
  );

  const loaded = data.status === "ready" ? data.data : null;
  // The dates Hedging can price: the planner's rules, plus the interest
  // rates compounded over the plan's length before the start (SORA from
  // July 2005), and no forward of more than 3 years from the latest rates.
  const checkDates = useCallback(
    (start: string, deadline: string): DateIssue | undefined => {
      if (!loaded) return undefined;
      const basic = startDateIssue(start, loaded.fx, scenario.currency, today);
      if (basic) return { field: "startDate", message: basic.message };
      const hedge = hedgeIssue(
        loaded.fx,
        ratesFirst(loaded),
        start,
        deadline,
        state.volLookback,
      );
      if (!hedge) return undefined;
      return {
        field: hedge.earliestStart ? "startDate" : "deadline",
        message: hedge.message,
      };
    },
    [loaded, scenario.currency, today, state.volLookback],
  );
  const issue = checkDates(scenario.startDate, scenario.deadline);
  const pastDeadline = pastDeadlineNote(scenario.deadline, today);

  return (
    <>
      {/* The scenario as compact, editable chips directly under the title. */}
      <div className="mt-8">
        <ScenarioForm
          state={state}
          onChange={setState}
          variant="chips"
          checkDates={checkDates}
          dateIssue={issue}
          startRange={{ min: loaded?.fx.dates[0], max: latestStart(today) }}
        />
        {pastDeadline && (
          <p className="t-small mt-3" data-testid="past-deadline">
            {pastDeadline}
          </p>
        )}
      </div>

      {currency.peggedToSgd ? (
        <Notice>
          The {currency.name} is pegged 1:1 to the Singapore dollar, so there is
          no exchange rate to hedge: every conversion costs the same, plus your
          spread. The planner shows it for every strategy.
        </Notice>
      ) : (
        !rateSeries && (
          <Notice>
            Forward and option pricing needs {scenario.currency} interest-rate
            history, which SpotCheck only has for USD so far. Pick USD above to
            see this page; the planner works for all 40 currencies.
          </Notice>
        )
      )}
      {data.status === "loading" && rateSeries && <HedgingSkeleton />}
      {data.status === "error" && (
        <div className="mt-10">
          <LoadError message={data.error} retry={data.retry} />
        </div>
      )}
      {loaded && issue && (
        <div role="alert" className="mt-10" data-testid="start-issue">
          <p className="t-h3">Hedging can&apos;t price this plan</p>
          <p className="prose-measure mt-2">{issue.message}</p>
        </div>
      )}
      {loaded && !issue && (
        <Panels data={loaded} state={state} setState={setState} today={today} />
      )}
    </>
  );
}

/** The later first date of the two interest-rate histories. */
function ratesFirst(d: Loaded): string {
  return [d.sora.dates[0]!, d.foreign.dates[0]!].sort().at(-1)!;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="prose-measure mt-10 flex gap-2 border-t pt-6">
      <Info aria-hidden className="mt-1 size-4 shrink-0 text-caution" />
      <span>{children}</span>
    </p>
  );
}

function Panels({
  data: d,
  state,
  setState,
  today,
}: {
  data: Loaded;
  state: PlannerState;
  setState: (next: PlannerState) => void;
  today: string;
}) {
  const s = state.scenario;
  const inputs: RateInputs = {
    fx: d.fx,
    sgdOvernight: d.sora,
    foreignOvernight: d.foreign,
    foreignBasis: 360,
  };
  // Price "today": the scenario start, but no later than the last FX date.
  const pricingDate = rateAsOf(d.fx, s.startDate).date;
  const ctx: StartContext = startContext(
    s.startDate,
    pricingDate,
    d.fx.dates.at(-1)!,
    today,
  );
  const deadline = s.deadline;
  const quote = priceForward(inputs, pricingDate, deadline);
  const vol = realisedVol(d.fx, pricingDate, state.volLookback);
  const T = daysBetween(pricingDate, deadline) / 365;

  // The historical comparison prices thousands of options; it runs in the
  // Web Worker and the previous chart stays up until it finishes.
  const option: OptionSettings = {
    strikePct: state.strikePct,
    volLookback: state.volLookback,
    volOverride: state.volOverride,
  };
  const history = useLoad(
    `hedge:${JSON.stringify([s, quote.spot, option])}`,
    async () => ({
      result: await computeHedges(inputs, s, quote.spot, option),
      strikePct: option.strikePct,
    }),
    { keepPrevious: true },
  );

  const K = quote.spot * state.strikePct;
  const premium = gkCall({
    S: quote.spot,
    K,
    rd: toContinuous(quote.rd, T),
    rf: toContinuous(quote.rf, T),
    T,
    sigma: Math.max(state.volOverride ?? vol.sigma, 1e-4),
  });
  const carry = (quote.forward - quote.spot) * s.amount;
  const amountText = `${s.amount.toLocaleString("en-SG")} ${s.currency}`;
  const forwardShare =
    history.status === "ready"
      ? share(
          history.data.result.relativeCosts.forward!,
          history.data.result.relativeCosts.unhedged!,
        )
      : undefined;

  return (
    <>
      {/* The answer: what fixing the rate would cost today, as prices. */}
      <section
        aria-label={fixingLabel(ctx)}
        className="mt-12 lg:grid lg:grid-cols-12 lg:gap-6"
      >
        <div className="lg:col-span-8">
          <p className="t-label">{fixingLabel(ctx)}</p>
          <p className="t-h2 mt-3 max-w-3xl font-medium" data-testid="answer">
            A forward would fix {formatRate(quote.forward)} SGD per {s.currency}{" "}
            for {formatDate(deadline)}:{" "}
            {formatSgdAt(Math.abs(carry), quote.spot * s.amount)}{" "}
            {carry < 0 ? "below" : "above"} {spotWhen(ctx)} for your{" "}
            {amountText}.
          </p>
          {/* The reason, at the same weight as the figure it explains. */}
          <p className="t-h2 mt-2 max-w-3xl font-medium" data-testid="carry">
            That&apos;s because {s.currency} interest rates are{" "}
            {quote.rf > quote.rd ? "higher" : "lower"} than SGD rates. That gap
            is carry, not a forecast.
          </p>
          <dl className="mt-6 grid border-t sm:grid-cols-3">
            <HeadlineFigure
              value={formatRate(quote.forward)}
              label={`SGD per ${s.currency}, the forward rate to ${formatDate(deadline)}`}
            />
            <HeadlineFigure
              value={formatSgd(premium * s.amount)}
              label={`premium for a call option with a ${Math.round(state.strikePct * 100)}% strike`}
            />
            <HeadlineFigure
              value={
                forwardShare === undefined
                  ? undefined
                  : formatPercent(forwardShare)
              }
              label={
                history.status === "ready"
                  ? `of ${history.data.result.windows.toLocaleString("en-SG")} past periods, the forward cost less than staying unhedged`
                  : "of past periods, the forward cost less than staying unhedged"
              }
            />
          </dl>
          <p className="t-small mt-5 font-medium">
            Past outcomes, not a forecast. Prices use past rates, not a bank
            quote.
          </p>
          <p
            className="t-small mt-2 text-muted-foreground"
            data-testid="fx-source"
          >
            {fxSourceLabel(findCurrency(s.currency)!)}
          </p>
        </div>
      </section>

      <div className="section grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-16 lg:grid-cols-2">
        <ForwardPanel
          ctx={ctx}
          quote={quote}
          currency={s.currency}
          amount={s.amount}
          sgdRateDate={rateAsOf(d.sora, pricingDate).date}
          foreignRateDate={rateAsOf(d.foreign, pricingDate).date}
        />
        <OptionPanel
          spotLabel={
            ctx.kind === "latest"
              ? "today"
              : ctx.kind === "past"
                ? formatDate(ctx.rateDate)
                : "latest"
          }
          currency={s.currency}
          amount={s.amount}
          spread={s.spread}
          deadline={deadline}
          base={{
            S: quote.spot,
            rd: toContinuous(quote.rd, T),
            rf: toContinuous(quote.rf, T),
            T,
          }}
          forward={quote.forward}
          strikePct={state.strikePct}
          realised={{
            sigma: vol.sigma,
            lookback: state.volLookback,
            from: vol.from,
            to: vol.to,
          }}
          volOverride={state.volOverride}
          onStrike={(strikePct) => setState({ ...state, strikePct })}
          onVol={(volOverride, volLookback) =>
            setState({ ...state, volOverride, volLookback })
          }
        />
      </div>
      <section aria-labelledby="history-title" className="section">
        <h2 id="history-title" className="t-h2">
          How each hedge would have worked out
        </h2>
        <p className="prose-measure mt-3 text-muted-foreground">
          Every past window of the same length since interest-rate data begins
          (SORA from July 2005), each priced with only the rates and volatility
          known on its first day, rescaled to {rescaledTo(ctx)} like the
          planner. Each window&apos;s forward uses SORA compounded over the same
          length of time before it starts, so the first window begins one
          window-length after SORA does.
        </p>
        <div className="mt-8 min-h-[36rem] space-y-8 lg:max-w-4xl">
          {history.status === "loading" && (
            <div aria-hidden className="space-y-8">
              <div className="skeleton h-[200px]" />
              <div className="skeleton h-48" />
            </div>
          )}
          {history.status === "error" && (
            <LoadError message={history.error} retry={history.retry} />
          )}
          {history.status === "ready" && (
            <HedgeHistory
              result={history.data.result}
              strikePct={history.data.strikePct}
            />
          )}
        </div>
      </section>
    </>
  );
}

/** Holds the panels' space while the rate files load. */
function HedgingSkeleton() {
  return (
    // Taller than any screen, so the footer never jumps when panels arrive.
    <div aria-hidden className="mt-12 space-y-6">
      <div className="skeleton h-9 w-3/4 max-w-2xl" />
      <div className="skeleton h-[60rem]" />
    </div>
  );
}

function HedgeHistory({
  result: h,
  strikePct,
}: {
  result: HedgeReplayResult;
  strikePct: number;
}) {
  const rows = (["unhedged", "forward", "option"] as HedgeId[]).map((id) => ({
    id,
    label: HEDGE_STYLE[id].label,
    shortLabel: HEDGE_STYLE[id].short,
    color: HEDGE_STYLE[id].color,
    summary: h.summaries[id]!,
    vsReference:
      id === "unhedged"
        ? undefined
        : h.summaries[id]!.median - h.summaries.unhedged!.median,
    cheaperShare:
      id === "unhedged"
        ? undefined
        : share(h.relativeCosts[id]!, h.relativeCosts.unhedged!),
  }));
  return (
    <>
      <RangeChart
        label="Range of SGD cost with no hedge, a forward, and a call option, across historical windows."
        rows={rows}
      />
      <ComparisonTable
        caption="SGD cost of each hedge across historical windows"
        rowHeader="Hedge"
        reference="unhedged"
        rows={rows}
      />
      <p className="t-small font-medium">{HISTORICAL_CONTEXT}</p>
      <p className="prose-measure">
        {h.windows.toLocaleString("en-SG")} windows starting{" "}
        {formatDate(h.firstStart)} to {formatDate(h.lastStart)}. The forward
        cost less than staying unhedged in{" "}
        {formatPercent(
          share(h.relativeCosts.forward!, h.relativeCosts.unhedged!),
        )}{" "}
        of them, and the option ({Math.round(strikePct * 100)}% strike) in{" "}
        {formatPercent(
          share(h.relativeCosts.option!, h.relativeCosts.unhedged!),
        )}
        . A forward fixes your rate today; an option caps it for an upfront
        premium. The figures above show how each changed the range of outcomes
        in this history.
      </p>
    </>
  );
}

function HeadlineFigure({ value, label }: { value?: string; label: string }) {
  return (
    <div className="flex flex-col-reverse justify-end gap-1 border-b py-4 sm:border-b-0 sm:pr-4 sm:[&+&]:border-l sm:[&+&]:pl-4">
      <dt className="t-small text-muted-foreground">{label}</dt>
      <dd className="t-data-m min-h-7 tabular-nums">
        {value ?? <span className="skeleton inline-block h-7 w-16" />}
      </dd>
    </div>
  );
}

/** Share of windows where `a` cost strictly less than `b`. */
function share(a: number[], b: number[]): number {
  return a.filter((x, i) => x < b[i]!).length / a.length;
}
