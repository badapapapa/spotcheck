"use client";

import { rateAsOf } from "@/engine/calendar.ts";
import { findCurrency, fxSourceLabel } from "@/engine/currencies.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { computeReplay } from "@/lib/compute.ts";
import { loadFx } from "@/lib/data.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatRate } from "@/lib/format.ts";
import { describeReplay } from "@/lib/summary.ts";
import { useLoad } from "@/lib/use-data.ts";
import { usePlannerState } from "@/lib/use-planner-state.ts";
import type { PlannerState } from "@/lib/url-state.ts";
import { CopyLinkButton } from "./CopyLinkButton";
import { DistributionChart } from "./DistributionChart";
import { Methodology } from "./Methodology";
import { OutcomeTable } from "./OutcomeTable";
import { SamplePath } from "./SamplePath";
import { ScenarioForm } from "./ScenarioForm";

export function Planner() {
  const [state, setState] = usePlannerState();
  const { scenario } = state;
  const currency = findCurrency(scenario.currency)!;
  const fx = useLoad(`fx:${scenario.currency}`, () =>
    loadFx(scenario.currency),
  );
  const series = fx.status === "ready" ? fx.data : undefined;
  const spot = series ? rateAsOf(series, scenario.startDate) : undefined;

  // Replaying ~10,000 windows runs in a Web Worker. The previous result
  // stays on screen until the new one arrives.
  const outcome = useLoad(
    series ? `replay:${JSON.stringify(state)}` : null,
    async (): Promise<{
      result: Awaited<ReturnType<typeof computeReplay>>;
      for: PlannerState;
    }> => ({
      result: await computeReplay(series!, state.scenario, {
        targetBelowSpot: state.targetBelowSpot,
      }),
      for: state,
    }),
    { keepPrevious: true },
  );
  // A stale result for a different currency would pair the wrong history
  // with the wrong rates, so only keep one for the same currency.
  const ready =
    outcome.status === "ready" &&
    outcome.data.for.scenario.currency === scenario.currency
      ? outcome.data
      : undefined;
  const result = ready?.result;
  const deferred = ready?.for ?? state;

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
            spot={spot?.value}
          />
        </CardContent>
      </Card>

      {currency.peggedToSgd && (
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          The Brunei dollar is pegged 1:1 to the Singapore dollar, so every
          strategy costs the same (plus your spread).
        </p>
      )}

      {fx.status === "loading" && (
        <p className="text-muted-foreground">
          Loading {scenario.currency} rates…
        </p>
      )}
      {fx.status === "error" && (
        <p role="alert" className="text-destructive">
          Couldn&apos;t load the rate history: {fx.error}
        </p>
      )}
      {outcome.status === "error" && (
        <p role="alert" className="text-destructive">
          {outcome.error}. Try a shorter period.
        </p>
      )}

      {result && series && spot && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>What each strategy would have cost</CardTitle>
              <CardDescription>
                {scenario.amount.toLocaleString("en-SG")} {scenario.currency} by{" "}
                {formatDate(scenario.deadline)}, starting from today&apos;s mid
                rate of {formatRate(spot.value)} SGD per {scenario.currency} (
                {formatDate(spot.date)}), with a{" "}
                {(scenario.spread * 100).toFixed(2)}% spread.
                <span className="mt-1 block text-xs" data-testid="fx-source">
                  {fxSourceLabel(currency)}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <DistributionChart result={result} />
              <div
                className="space-y-2 text-sm leading-relaxed"
                data-testid="summary"
              >
                {describeReplay(
                  result,
                  deferred.scenario,
                  deferred.targetBelowSpot,
                ).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium">
                  Show the numbers as a table
                </summary>
                <div className="pt-3">
                  <OutcomeTable result={result} />
                </div>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Look at one window</CardTitle>
              <CardDescription>
                Slide through history to see when each strategy converted and at
                what rate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SamplePath
                key={`${result.startDates.length}:${result.windowDays}`}
                fx={series}
                scenario={deferred.scenario}
                targetBelowSpot={deferred.targetBelowSpot}
                startDates={result.startDates}
              />
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <CopyLinkButton />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Methodology</h2>
        <Methodology />
      </section>
    </div>
  );
}
