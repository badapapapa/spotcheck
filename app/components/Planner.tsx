"use client";

import { Download, Pencil } from "lucide-react";
import Link from "next/link";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { rateAsOf } from "@/engine/calendar.ts";
import { findCurrency, fxSourceLabel } from "@/engine/currencies.ts";
import type { ReplayResult } from "@/engine/replay.ts";
import { sampleWindow } from "@/engine/replay.ts";
import { STRATEGY_IDS } from "@/engine/types.ts";
import { windowCount } from "@/lib/periods.ts";
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
import { DistributionChart } from "./DistributionChart";
import { Glance, GlanceProgress, HISTORICAL_CONTEXT } from "./Glance";
import { ScenarioForm } from "./ScenarioForm";
import { StrategyGuide } from "./StrategyGuide";

// Both sit well below the first screen, and SamplePath brings in the chart
// library. Loading them just after the page keeps the first paint light;
// their space is held by placeholders of the same size meanwhile.
const OutcomeTimeline = lazy(() =>
  import("./OutcomeTimeline").then((m) => ({ default: m.OutcomeTimeline })),
);
const SamplePath = lazy(() =>
  import("./SamplePath").then((m) => ({ default: m.SamplePath })),
);

/**
 * The planner, after the static question (app/page.tsx). It returns its
 * parts as siblings on the page grid (`.layout`): the converter under the
 * question, the result beside it, then the evidence, the exploration, the
 * strategies and the evidence strip (DESIGN.md §4).
 */
export function Planner() {
  const [state, setState] = usePlannerState();
  const { scenario } = state;
  const currency = findCurrency(scenario.currency)!;
  const fx = useLoad(`fx:${scenario.currency}`, () =>
    loadFx(scenario.currency),
  );
  const series = fx.status === "ready" ? fx.data : undefined;
  const spot = series ? rateAsOf(series, scenario.startDate) : undefined;

  // Replaying ~7,000 windows runs in a Web Worker. The previous result
  // stays on screen (dimmed) until the new one arrives.
  const outcome = useLoad(
    series ? `replay:${JSON.stringify(state)}` : null,
    async (): Promise<{ result: ReplayResult; for: PlannerState }> => ({
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
  const stale = outcome.status === "ready" && outcome.stale === true;
  const deferred = ready?.for ?? state;
  const periodsToCheck = useMemo(
    () => (series ? windowCount(series, scenario) : undefined),
    [series, scenario],
  );

  // The period picked on the timeline or slider (latest by default). It
  // lives here so the Excel export and the detail share it. A new set of
  // periods starts again from the latest.
  const windowsKey = result
    ? `${result.startDates.length}:${result.windowDays}`
    : "";
  const [picked, setPicked] = useState<{ key: string; index: number }>();
  const index = result
    ? picked?.key === windowsKey
      ? picked.index
      : result.startDates.length - 1
    : 0;
  const select = (i: number) => setPicked({ key: windowsKey, index: i });
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

  // One highlighted strategy, shared by every chart and table. Only ever set
  // by the user: hovering or focusing previews it, clicking pins it.
  const [hovered, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = hovered ?? pinned;
  const toggle = (id: string) => setPinned((p) => (p === id ? null : id));

  const converterRef = useRef<HTMLElement>(null);
  const showBar = useScrolledPast(converterRef);
  const months = result ? Math.round(result.windowDays / 30.44) : undefined;

  return (
    <>
      {/* The converter, directly under the question. */}
      <section
        ref={converterRef}
        aria-label="Your plan"
        className="col-main converter-min-h mt-8 self-start rounded-lg border bg-surface p-4 sm:p-6 lg:row-start-2"
      >
        <ScenarioForm state={state} onChange={setState} spot={spot?.value} />
        {fx.status === "error" && (
          <p role="alert" className="t-small mt-4 text-negative">
            Couldn&apos;t load the rate history: {fx.error}
          </p>
        )}
      </section>

      {/* The answer, beside the question on laptops and under it on phones. */}
      <section
        aria-label="Comparison at a glance"
        className="col-side result-min-h mt-8 self-start rounded-lg border bg-surface p-4 sm:p-6 lg:row-span-2 lg:row-start-1 lg:mt-2"
      >
        {outcome.status === "error" ? (
          <p role="alert" className="text-negative">
            {outcome.error}. Try a shorter period.
          </p>
        ) : result ? (
          <div className="fade-in">
            <Glance
              result={result}
              pegged={currency.peggedToSgd === true}
              stale={stale}
              active={active}
              pinned={pinned}
              onHover={setActive}
              onToggle={toggle}
            />
          </div>
        ) : (
          <GlanceProgress periods={periodsToCheck} />
        )}
      </section>

      {/* Evidence: the four strategies side by side. */}
      <section
        id="evidence"
        aria-labelledby="evidence-title"
        className="section scroll-mt-6"
      >
        {/* Heading row: title on the left, how to read it on the right. */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-6">
          <h2 id="evidence-title" className="t-h2 lg:col-span-5">
            How the four strategies compared
          </h2>
          <div className="mt-3 lg:col-span-6 lg:col-start-7 lg:mt-0">
            <p className="text-muted-foreground">
              {result && months
                ? `Every ${months}-month period since ${formatDate(result.firstStart)}, each cost rescaled to today's rate.`
                : "Every past period of the same length as yours, each cost rescaled to today's rate."}
            </p>
            {spot && (
              <p className="t-small mt-3 text-muted-foreground">
                Today&apos;s mid rate: {formatRate(spot.value)} SGD per{" "}
                {scenario.currency} ({formatDate(spot.date)}).
              </p>
            )}
            <p
              className="t-small mt-1 text-muted-foreground"
              data-testid="fx-source"
            >
              {fxSourceLabel(currency)}
            </p>
          </div>
        </div>
        <div className="mt-10">
          {result ? (
            <div className="space-y-8">
              <DistributionChart
                result={result}
                active={active}
                onActive={setActive}
                onToggle={toggle}
              />
              <div>
                <ComparisonTable
                  caption="SGD cost of each strategy across comparable past periods"
                  rowHeader="Strategy"
                  active={active}
                  onActive={setActive}
                  reference="all at once"
                  rows={STRATEGY_IDS.map((id) => ({
                    id,
                    vsReference:
                      id === "lumpSum"
                        ? undefined
                        : result.stats[id].summary.median -
                          result.stats.lumpSum.summary.median,
                    cheaperShare:
                      id === "lumpSum"
                        ? undefined
                        : result.stats[id].beatLumpSum,
                    label: STRATEGY_STYLE[id].label,
                    color: STRATEGY_STYLE[id].color,
                    summary: result.stats[id].summary,
                  }))}
                />
                <p className="t-small mt-3 text-muted-foreground">
                  Median vs all at once: the difference from converting it all
                  today. Middle 90%: from low to high, the range 90% of past
                  periods fell in. Worst case: the most expensive period.
                  Cheaper: the share of periods that cost less than converting
                  all at once.
                </p>
                <p className="t-small mt-2 font-medium">{HISTORICAL_CONTEXT}</p>
              </div>
              <div data-testid="summary" className="prose-measure space-y-3">
                <h3 className="t-h3">In plain words</h3>
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
            <div aria-hidden className="space-y-8">
              <div className="skeleton h-[244px]" />
              <div className="skeleton h-56" />
            </div>
          )}
        </div>
      </section>

      {/* Exploration: every past period, then one in detail. */}
      <section
        aria-labelledby="explore-title"
        className="bleed mt-16 bg-sunken py-12 lg:mt-24 lg:py-16"
      >
        <div className="page">
          <div className="lg:grid lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-7">
              <h2 id="explore-title" className="t-h2">
                What if you had converted in another period?
              </h2>
              <p className="mt-3 text-muted-foreground">
                Each line is what a strategy would have cost, at today&apos;s
                rate, if your plan had started on that day. Pick a day to see
                exactly what happened.
              </p>
            </div>
          </div>
          {/* Legend plus chart: 2 legend rows on phones, 1 on laptops. */}
          <div className="mt-8 min-h-[320px] sm:min-h-[336px]">
            {result ? (
              <Suspense
                fallback={
                  <div
                    aria-hidden
                    className="skeleton h-[320px] bg-paper sm:h-[336px]"
                  />
                }
              >
                <OutcomeTimeline
                  result={result}
                  amount={deferred.scenario.amount}
                  selected={index}
                  onSelect={select}
                  active={active}
                  pinned={pinned}
                  onActive={setActive}
                  onToggle={toggle}
                />
              </Suspense>
            ) : (
              <div
                aria-hidden
                className="skeleton h-[320px] bg-paper sm:h-[336px]"
              />
            )}
          </div>

          <div className="mt-10 border-t pt-8">
            {result && series && sample ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <h3 className="t-h3">
                    The period starting {formatDate(sample.start)}
                  </h3>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={exportXlsx}
                    disabled={exporting}
                  >
                    <Download aria-hidden className="size-4" />
                    {exporting ? "Preparing…" : "Download Excel"}
                    <span className="sr-only"> of this period</span>
                  </button>
                </div>
                <div className="mt-6">
                  <Suspense
                    fallback={
                      <div
                        aria-hidden
                        className="skeleton h-[34rem] bg-paper"
                      />
                    }
                  >
                    <SamplePath
                      fx={series}
                      scenario={deferred.scenario}
                      targetBelowSpot={deferred.targetBelowSpot}
                      startDates={result.startDates}
                      index={index}
                      onIndex={select}
                      window={sample}
                    />
                  </Suspense>
                </div>
              </>
            ) : (
              <div aria-hidden className="skeleton h-[34rem] bg-paper" />
            )}
          </div>
        </div>
      </section>

      {/* The strategies, in plain terms. */}
      <section
        aria-labelledby="strategies-title"
        className="mt-16 lg:mt-24 lg:grid lg:grid-cols-12 lg:gap-6"
      >
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-8">
            <h2 id="strategies-title" className="t-h2">
              The four strategies, in plain terms
            </h2>
            <p className="mt-3 text-muted-foreground">
              What each one means you would actually do, and what it trades
              away.
            </p>
          </div>
        </div>
        <div className="mt-6 lg:col-span-8 lg:mt-0">
          <StrategyGuide />
        </div>
      </section>

      {/* Why the result can be trusted, and what it isn't. */}
      <EvidenceStrip
        result={result}
        series={series}
        source={fxSourceLabel(currency)}
      />

      {showBar && (
        <SummaryBar
          text={`${scenario.currency} ${scenario.amount.toLocaleString("en-SG")} by ${formatDate(scenario.deadline)}`}
          onEdit={() => {
            converterRef.current?.scrollIntoView({ block: "center" });
            converterRef.current?.querySelector("input")?.focus();
          }}
        />
      )}
    </>
  );
}

/**
 * The trust strip (DESIGN.md §7): how much history sits behind the result,
 * where it comes from and how current it is. Every figure is from the data.
 */
function EvidenceStrip({
  result,
  series,
  source,
}: {
  result?: ReplayResult;
  series?: { dates: string[] };
  source: string;
}) {
  const last = series?.dates.at(-1);
  const first = series?.dates[0];
  const years =
    first && last
      ? Math.floor(
          (Date.parse(last) - Date.parse(first)) / (365.25 * 86_400_000),
        )
      : undefined;
  const figures: [string | undefined, string][] = [
    [years?.toString(), "years of daily exchange rates"],
    [result?.windows.toLocaleString("en-SG"), "comparable periods tested"],
    [
      result?.independentWindows.toLocaleString("en-SG"),
      "separate histories, once overlaps are counted",
    ],
    [last ? formatDate(last) : undefined, "latest rate in the data"],
  ];
  return (
    <section aria-labelledby="trust-title" className="section">
      <h2 id="trust-title" className="t-h2">
        The evidence behind this
      </h2>
      <dl className="mt-8 grid grid-cols-2 gap-y-8 lg:grid-cols-4">
        {figures.map(([value, label], i) => (
          <div
            key={label}
            // Label after the figure in the DOM order screen readers expect
            // (dt, dd), but drawn figure-first.
            className={`flex flex-col-reverse justify-end gap-1 pr-4 ${i % 2 === 1 ? "border-l pl-4" : ""} ${i === 2 ? "lg:border-l" : ""} ${i > 0 ? "lg:pl-6" : ""}`}
          >
            <dt className="t-small text-muted-foreground">{label}</dt>
            <dd className="t-data-l min-h-11 tabular-nums">
              {value ?? <span className="skeleton inline-block h-9 w-24" />}
            </dd>
          </div>
        ))}
      </dl>
      <div className="prose-measure mt-10 space-y-3 text-muted-foreground">
        <p>
          {source} These are mid-market reference rates; your bank&apos;s spread
          is added to every conversion. Past periods show what happened, not
          what comes next: future rates can move in ways this history never did.
        </p>
        <p>
          <Link href="/how-it-works" prefetch={false} className="link">
            How SpotCheck works: the method, the data and its limits
          </Link>
        </p>
      </div>
    </section>
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
 * Phones: once the converter scrolls away, a bar along the top edge keeps
 * the scenario in view, with a way back to edit it.
 */
function SummaryBar({ text, onEdit }: { text: string; onEdit: () => void }) {
  return (
    <div className="fixed inset-x-0 top-0 z-30 border-b bg-paper lg:hidden">
      <div className="page flex h-14 items-center justify-between gap-3">
        <p className="truncate font-medium tabular-nums">{text}</p>
        <button type="button" className="btn-secondary px-3" onClick={onEdit}>
          <Pencil aria-hidden className="size-4" />
          Edit
        </button>
      </div>
    </div>
  );
}

/** The loading shape of the converter and result, for the static page. */
export function PlannerFallback() {
  return (
    <>
      <div
        aria-hidden
        className="col-main converter-min-h mt-8 rounded-lg border bg-surface lg:row-start-2"
      />
      <div className="col-side result-min-h mt-8 rounded-lg border bg-surface p-4 sm:p-6 lg:row-span-2 lg:row-start-1 lg:mt-2">
        <GlanceProgress />
      </div>
    </>
  );
}
