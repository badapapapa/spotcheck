"use client";

import Link from "next/link";
import { useDeferredValue, useMemo } from "react";
import { daysBetween, rateAsOf } from "@/engine/calendar.ts";
import { findCurrency } from "@/engine/currencies.ts";
import { priceForward, type RateInputs } from "@/engine/forwards.ts";
import {
  hedgeReplay,
  makeOptionPricer,
  type HedgeId,
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
import { loadFx, loadRate, loadSora } from "@/lib/data.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatPercent } from "@/lib/format.ts";
import { HEDGE_STYLE } from "@/lib/hedge-style.ts";
import { useLoad } from "@/lib/use-data.ts";
import { usePlannerState } from "@/lib/use-planner-state.ts";
import { serializeState, type PlannerState } from "@/lib/url-state.ts";
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
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hedging: forwards and options
        </h1>
        <p className="text-muted-foreground">
          For the same scenario as the{" "}
          <Link
            href={`/?${serializeState(state).toString()}`}
            className="underline underline-offset-2"
          >
            planner
          </Link>
          : what locking a forward or buying an option would cost today, and how
          each would have worked out in the past.
        </p>
      </section>

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
  const deferred = useDeferredValue(state);
  const s = deferred.scenario;
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
  const vol = realisedVol(d.fx, pricingDate, deferred.volLookback);
  const T = daysBetween(pricingDate, deadline) / 365;

  const history = useMemo(() => {
    try {
      return hedgeReplay(
        inputs,
        s,
        quote.spot,
        makeOptionPricer(d.fx, {
          strikePct: deferred.strikePct,
          volLookback: deferred.volLookback,
          volOverride: deferred.volOverride,
        }),
      );
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    d,
    s,
    quote.spot,
    deferred.strikePct,
    deferred.volLookback,
    deferred.volOverride,
  ]);

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
          {typeof history === "string" ? (
            <p role="alert" className="text-destructive">
              {history}
            </p>
          ) : (
            <>
              <RangeChart
                label="Range of SGD cost with no hedge, a forward, and a call option, across historical windows."
                rows={(["unhedged", "forward", "option"] as HedgeId[]).map(
                  (id) => ({
                    id,
                    label: HEDGE_STYLE[id].label,
                    color: HEDGE_STYLE[id].color,
                    summary: history.summaries[id]!,
                  }),
                )}
              />
              <p className="text-sm text-muted-foreground">
                {history.windows.toLocaleString("en-SG")} windows starting{" "}
                {formatDate(history.firstStart)} to{" "}
                {formatDate(history.lastStart)}. The forward cost less than
                staying unhedged in{" "}
                {formatPercent(
                  share(
                    history.relativeCosts.forward!,
                    history.relativeCosts.unhedged!,
                  ),
                )}{" "}
                of them, and the option ({Math.round(state.strikePct * 100)}%
                strike) in{" "}
                {formatPercent(
                  share(
                    history.relativeCosts.option!,
                    history.relativeCosts.unhedged!,
                  ),
                )}
                . A hedge narrows the range of outcomes; it doesn&apos;t make
                the average cheaper.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** Share of windows where `a` cost strictly less than `b`. */
function share(a: number[], b: number[]): number {
  return a.filter((x, i) => x < b[i]!).length / a.length;
}
