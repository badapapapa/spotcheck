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
import { loadFx, loadRate, loadSora } from "@/lib/data.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatPercent, formatRate, formatSgd } from "@/lib/format.ts";
import { HEDGE_STYLE } from "@/lib/hedge-style.ts";
import { useLoad } from "@/lib/use-data.ts";
import { usePlannerState } from "@/lib/use-planner-state.ts";
import type { PlannerState } from "@/lib/url-state.ts";
import { Info } from "lucide-react";
import { ComparisonTable } from "../ComparisonTable";
import { RangeChart } from "../DistributionChart";
import { ScenarioForm } from "../ScenarioForm";
import { ForwardPanel } from "./ForwardPanel";
import { OptionPanel } from "./OptionPanel";

type Loaded = { fx: Series; sora: Series; foreign: Series };

export function Advanced() {
  const [state, setState] = usePlannerState();
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

  return (
    <>
      {/* The scenario as compact, editable chips directly under the title. */}
      <div className="mt-8">
        <ScenarioForm state={state} onChange={setState} variant="chips" />
      </div>

      {!rateSeries && (
        <p className="prose-measure mt-10 flex gap-2 border-t pt-6">
          <Info aria-hidden className="mt-1 size-4 shrink-0 text-caution" />
          <span>
            Forward and option pricing needs {scenario.currency} interest-rate
            history, which SpotCheck only has for USD so far. Pick USD above to
            see this page; the planner works for all 40 currencies.
          </span>
        </p>
      )}
      {data.status === "loading" && rateSeries && <HedgingSkeleton />}
      {data.status === "error" && (
        <p role="alert" className="mt-10 text-negative">
          Couldn&apos;t load the data: {data.error}
        </p>
      )}
      {data.status === "ready" && data.data && (
        <Panels data={data.data} state={state} setState={setState} />
      )}
    </>
  );
}

function Panels({
  data: d,
  state,
  setState,
}: {
  data: Loaded;
  state: PlannerState;
  setState: (next: PlannerState) => void;
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
        aria-label="Fixing the rate today"
        className="mt-12 lg:grid lg:grid-cols-12 lg:gap-6"
      >
        <div className="lg:col-span-8">
          <p className="t-label">Fixing the rate today</p>
          <p className="t-result mt-4" data-testid="answer">
            A forward would fix {formatRate(quote.forward)} SGD per {s.currency}{" "}
            for {formatDate(deadline)}: {formatSgd(Math.abs(carry))}{" "}
            {carry < 0 ? "below" : "above"} today&apos;s spot for your{" "}
            {amountText}.
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
          quote={quote}
          currency={s.currency}
          amount={s.amount}
          sgdRateDate={rateAsOf(d.sora, pricingDate).date}
          foreignRateDate={rateAsOf(d.foreign, pricingDate).date}
        />
        <OptionPanel
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
          known on its first day, rescaled to today&apos;s rate like the
          planner.
        </p>
        <div className="mt-8 min-h-[36rem] space-y-8 lg:max-w-4xl">
          {history.status === "loading" && (
            <div aria-hidden className="space-y-8">
              <div className="skeleton h-[200px]" />
              <div className="skeleton h-48" />
            </div>
          )}
          {history.status === "error" && (
            <p role="alert" className="text-negative">
              {history.error}
            </p>
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
        rows={rows}
      />
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
        . A hedge narrows the range of outcomes; it doesn&apos;t make the
        average cheaper.
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
