"use client";

import { daysBetween, rateAsOf } from "@/engine/calendar.ts";
import { findCurrency } from "@/engine/currencies.ts";
import { priceForward, type RateInputs } from "@/engine/forwards.ts";
import type {
  HedgeId,
  HedgeReplayResult,
  OptionSettings,
} from "@/engine/hedge-replay.ts";
import { toContinuous } from "@/engine/rates.ts";
import { realisedVol } from "@/engine/stats.ts";
import type { Series } from "@/engine/types.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { computeHedges } from "@/lib/compute.ts";
import { loadFx, loadRate, loadSora } from "@/lib/data.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatPercent } from "@/lib/format.ts";
import { HEDGE_STYLE } from "@/lib/hedge-style.ts";
import { useLoad } from "@/lib/use-data.ts";
import { usePlannerState } from "@/lib/use-planner-state.ts";
import type { PlannerState } from "@/lib/url-state.ts";
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <ScenarioForm
            key={scenario.currency}
            state={state}
            onChange={setState}
          />
        </CardContent>
      </Card>

      {!rateSeries && (
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          Forward and option pricing needs {scenario.currency} interest-rate
          history, which SpotCheck only has for USD so far. Pick USD above to
          see this page; the planner works for all 40 currencies.
        </p>
      )}
      {data.status === "loading" && rateSeries && (
        <p className="text-muted-foreground">Loading rates…</p>
      )}
      {data.status === "error" && (
        <p role="alert" className="text-destructive">
          Couldn&apos;t load the data: {data.error}
        </p>
      )}
      {data.status === "ready" && data.data && (
        <Panels data={data.data} state={state} setState={setState} />
      )}
    </div>
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

  return (
    <>
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
      <Card>
        <CardHeader>
          <CardTitle>How each hedge would have worked out</CardTitle>
          <CardDescription>
            Every past window of the same length since interest-rate data begins
            (SORA from July 2005), each priced with only the rates and
            volatility known on its first day, rescaled to today&apos;s rate
            like the planner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.status === "loading" && (
            <p className="text-muted-foreground">Replaying history…</p>
          )}
          {history.status === "error" && (
            <p role="alert" className="text-destructive">
              {history.error}
            </p>
          )}
          {history.status === "ready" && (
            <HedgeHistory
              result={history.data.result}
              strikePct={history.data.strikePct}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function HedgeHistory({
  result: h,
  strikePct,
}: {
  result: HedgeReplayResult;
  strikePct: number;
}) {
  return (
    <>
      <RangeChart
        label="Range of SGD cost with no hedge, a forward, and a call option, across historical windows."
        rows={(["unhedged", "forward", "option"] as HedgeId[]).map((id) => ({
          id,
          label: HEDGE_STYLE[id].label,
          color: HEDGE_STYLE[id].color,
          summary: h.summaries[id]!,
        }))}
      />
      <p className="text-sm text-muted-foreground">
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

/** Share of windows where `a` cost strictly less than `b`. */
function share(a: number[], b: number[]): number {
  return a.filter((x, i) => x < b[i]!).length / a.length;
}
