"use client";

import { Download, Info, Pencil } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { rateAsOf } from "@/engine/calendar.ts";
import { findCurrency, fxSourceLabel } from "@/engine/currencies.ts";
import { sampleWindow } from "@/engine/replay.ts";
import { STRATEGY_IDS } from "@/engine/types.ts";
import { computeReplay } from "@/lib/compute.ts";
import { loadFx } from "@/lib/data.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatRate } from "@/lib/format.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { describeReplay } from "@/lib/summary.ts";
import { useLoad } from "@/lib/use-data.ts";
import { usePlannerState } from "@/lib/use-planner-state.ts";
import type { PlannerState } from "@/lib/url-state.ts";
import { ComparisonTable } from "./ComparisonTable";
import { CopyLinkButton } from "./CopyLinkButton";
import { DistributionChart } from "./DistributionChart";
import { Methodology } from "./Methodology";
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

  // The window picked in "Look at one window" (latest by default). It lives
  // here so the Download Excel button in the results header can export it.
  // A new set of windows starts again from the latest.
  const windowsKey = result
    ? `${result.startDates.length}:${result.windowDays}`
    : "";
  const [picked, setPicked] = useState<{ key: string; index: number }>();
  const index = result
    ? picked?.key === windowsKey
      ? picked.index
      : result.startDates.length - 1
    : 0;
  const sample = useMemo(
    () =>
      result && series
        ? sampleWindow(series, deferred.scenario, result.startDates[index]!, {
            targetBelowSpot: deferred.targetBelowSpot,
          })
        : undefined,
    [result, series, deferred, index],
  );

  const [exporting, setExporting] = useState(false);
  async function exportXlsx() {
    if (!series || !sample) return;
    setExporting(true);
    try {
      // Loaded on demand: ExcelJS is large and most visitors never export.
      const { downloadWorkbook } = await import("@/lib/xlsx.ts");
      await downloadWorkbook(
        series,
        deferred.scenario,
        deferred.targetBelowSpot,
        sample,
      );
    } finally {
      setExporting(false);
    }
  }

  const converterRef = useRef<HTMLElement>(null);
  const showBar = useScrolledPast(converterRef);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[40rem_minmax(0,1fr)] xl:items-start">
        <section
          ref={converterRef}
          aria-label="Converter"
          className="panel panel-raised converter-min-h xl:sticky xl:top-6"
        >
          <ScenarioForm state={state} onChange={setState} spot={spot?.value} />
          {currency.peggedToSgd && (
            <p className="mt-4 flex gap-2 text-sm text-muted-foreground">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              The Brunei dollar is pegged 1:1 to the Singapore dollar, so every
              strategy costs the same (plus your spread).
            </p>
          )}
          {fx.status === "error" && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              Couldn&apos;t load the rate history: {fx.error}
            </p>
          )}
        </section>

        <section aria-labelledby="results-title" className="panel">
          <ResultsHeader
            onDownload={exportXlsx}
            downloadDisabled={!sample || exporting}
            exporting={exporting}
          />
          <p
            className="mt-2 text-xs text-muted-foreground"
            data-testid="fx-source"
          >
            {fxSourceLabel(currency)}
          </p>

          {outcome.status === "error" && (
            <p role="alert" className="mt-4 text-destructive">
              {outcome.error}. Try a shorter period.
            </p>
          )}

          {result ? (
            <div className="mt-6 space-y-6">
              <DistributionChart result={result} />
              <div>
                <ComparisonTable
                  caption="SGD cost of each strategy across historical windows"
                  rowHeader="Strategy"
                  rows={STRATEGY_IDS.map((id) => ({
                    id,
                    label: STRATEGY_STYLE[id].label,
                    color: STRATEGY_STYLE[id].color,
                    summary: result.stats[id].summary,
                  }))}
                />
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>
                    Middle 90%: from low to high, the range 90% of past windows
                    fell in. Worst case: the most expensive window.
                  </p>
                  {spot && (
                    <p>
                      {scenario.amount.toLocaleString("en-SG")}{" "}
                      {scenario.currency} by {formatDate(scenario.deadline)},
                      starting from today&apos;s mid rate of{" "}
                      {formatRate(spot.value)} SGD per {scenario.currency} (
                      {formatDate(spot.date)}), with a{" "}
                      {(scenario.spread * 100).toFixed(2)}% spread.
                    </p>
                  )}
                </div>
              </div>
              <div
                className="space-y-2 border-t pt-5 text-[15px] leading-relaxed"
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
            </div>
          ) : (
            outcome.status !== "error" && <ResultsSkeleton />
          )}
        </section>
      </div>

      <section aria-labelledby="window-title" className="section-rule">
        <h2
          id="window-title"
          className="text-lg leading-7 font-bold sm:text-xl"
        >
          Look at one window
        </h2>
        <p className="mt-1 text-muted-foreground">
          Slide through history to see when each strategy converted and at what
          rate.
        </p>
        <div className="mt-6 min-h-[34rem]">
          {result && series && sample ? (
            <SamplePath
              fx={series}
              scenario={deferred.scenario}
              targetBelowSpot={deferred.targetBelowSpot}
              startDates={result.startDates}
              index={index}
              onIndex={(i) => setPicked({ key: windowsKey, index: i })}
              window={sample}
            />
          ) : (
            <div aria-hidden className="skeleton h-[34rem]" />
          )}
        </div>
      </section>

      <section aria-labelledby="method-title" className="section-rule">
        <h2
          id="method-title"
          className="text-lg leading-7 font-bold sm:text-xl"
        >
          Methodology
        </h2>
        <div className="mt-2">
          <Methodology />
        </div>
      </section>

      {showBar && (
        <SummaryBar
          text={`${scenario.currency} ${scenario.amount.toLocaleString("en-SG")} by ${formatDate(scenario.deadline)}`}
          onEdit={() => {
            converterRef.current?.scrollIntoView({ block: "start" });
            converterRef.current?.querySelector("input")?.focus();
          }}
        />
      )}
    </div>
  );
}

/**
 * Title and the two actions. Also drawn, disabled, in the static loading
 * fallback, so the heading paints before any script runs.
 */
export function ResultsHeader({
  onDownload,
  downloadDisabled = true,
  exporting = false,
}: {
  onDownload?: () => void;
  downloadDisabled?: boolean;
  exporting?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <h2 id="results-title" className="text-lg leading-7 font-bold sm:text-xl">
        What each strategy would have cost
      </h2>
      <div className="flex flex-wrap gap-2">
        <CopyLinkButton />
        <button
          type="button"
          className="btn-secondary"
          onClick={onDownload}
          disabled={downloadDisabled}
        >
          <Download aria-hidden className="size-4" />
          {exporting ? "Preparing…" : "Download Excel"}
          <span className="sr-only">
            {" "}
            of the window selected under &ldquo;Look at one window&rdquo;
          </span>
        </button>
      </div>
    </div>
  );
}

/** Holds the results' space while the first replay runs (no layout shift). */
export function ResultsSkeleton() {
  return (
    <div aria-hidden className="mt-6 space-y-6">
      <div className="skeleton h-[332px]" />
      <div className="skeleton h-56" />
    </div>
  );
}

/** True once the element has scrolled up out of view (phones only). */
function useScrolledPast(ref: React.RefObject<HTMLElement | null>) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) =>
      setPast(!e!.isIntersecting && e!.boundingClientRect.bottom < 0),
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return past;
}

/**
 * Phones: once the converter scrolls away, a bar under the top edge keeps the
 * scenario in view, with a way back to edit it.
 */
function SummaryBar({ text, onEdit }: { text: string; onEdit: () => void }) {
  return (
    <div className="fixed inset-x-0 top-0 z-30 border-b bg-card lg:hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <p className="truncate font-heading font-bold text-heading tabular-nums">
          {text}
        </p>
        <button type="button" className="btn-secondary px-3" onClick={onEdit}>
          <Pencil aria-hidden className="size-4" />
          Edit
        </button>
      </div>
    </div>
  );
}
