"use client";

import { memo, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { fromEpochDay, indexOnOrAfter, toEpochDay } from "@/engine/calendar.ts";
import type { sampleWindow } from "@/engine/replay.ts";
import {
  STRATEGY_IDS,
  type Scenario,
  type Series,
  type StrategyId,
} from "@/engine/types.ts";
import { formatDate, formatMonth } from "@/lib/dates.ts";
import {
  formatPct,
  formatPegRate,
  formatRate as formatAnyRate,
  formatSgdAt,
} from "@/lib/format.ts";
import { findCurrency } from "@/engine/currencies.ts";
import { AXIS_STROKE, AXIS_TICK, LINE_WIDTH } from "@/lib/chart-style.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { niceTicks } from "@/lib/ticks.ts";
import { useCoarsePointer } from "@/lib/use-coarse-pointer.ts";
import { ChartLegend, Marker, PointMark } from "./ChartLegend.tsx";

export type Window = ReturnType<typeof sampleWindow>;

type Props = {
  fx: Series;
  scenario: Scenario;
  targetBelowSpot: number;
  /** The selected window. The planner owns it so Download Excel can export it. */
  window: Window;
  /** The same window's costs at today's rate, as the timeline readout shows. */
  today?: { scale: number; costs: Record<StrategyId, number> };
  /** What costs are rescaled to: "today's rate", "the rate on 2 Jan 2025". */
  rescaled: string;
};

/**
 * One historical window: the rate line, and where each strategy converted.
 * Memoised: while the timeline is scrubbed, the planner re-renders the
 * detail with its previous (deferred) period first, and this skips that.
 */
export const SamplePath = memo(function SamplePath({
  fx,
  scenario,
  targetBelowSpot,
  window: w,
  today,
  rescaled,
}: Props) {
  // A pegged currency's rates read like the peg (1.0000, 0.9800).
  const formatRate = findCurrency(scenario.currency)?.peggedToSgd
    ? formatPegRate
    : formatAnyRate;
  /** Each strategy's conversions on an epoch day, in the fixed order. */
  const conversionsOn = (day: number) =>
    STRATEGY_IDS.flatMap((sid) =>
      w.results[sid].conversions
        .filter((c) => toEpochDay(c.date) === day)
        .map((c) => ({ sid, rate: c.rate })),
    );
  const coarse = useCoarsePointer();
  // The point last tapped, for the touch readout under the chart.
  // The point last tapped, for this period only: a new period (picked on
  // the timeline) starts with no point, and the chart below is keyed by the
  // period, so Recharts' own cursor can't linger without a readout either.
  const [tapped, setTapped] = useState<{ start: string; i?: number }>();
  const at = tapped?.start === w.start ? tapped.i : undefined;
  const setAt = (i: number | undefined) => setTapped({ start: w.start, i });

  const line = useMemo(() => {
    const out: { x: number; rate: number }[] = [];
    for (
      let i = indexOnOrAfter(fx, w.start);
      i >= 0 && i < fx.dates.length && fx.dates[i]! <= w.deadline;
      i++
    ) {
      out.push({ x: toEpochDay(fx.dates[i]!), rate: fx.values[i]! });
    }
    // Include the day the deadline conversion actually happened (may snap forward).
    const lastTrade = w.results.wait.conversions[0]!;
    if (out.at(-1)?.x !== toEpochDay(lastTrade.date))
      out.push({ x: toEpochDay(lastTrade.date), rate: lastTrade.rate });
    return out;
  }, [fx, w]);

  /**
   * Strategies that convert on the same day would hide each other's marker
   * (All at once under Equal tranches' first part, Wait until deadline
   * under Target rate's). They sit side by side instead, 11px apart,
   * centred on the day, in the fixed order.
   */
  const offsetOn = (sid: StrategyId, day: number) => {
    const same = STRATEGY_IDS.filter((s) =>
      w.results[s].conversions.some((c) => toEpochDay(c.date) === day),
    );
    const k = same.indexOf(sid);
    // At the plot's edges the group opens inwards, so none is clipped.
    if (day <= line[0]!.x) return k * 11;
    if (day >= line.at(-1)!.x) return (k - same.length + 1) * 11;
    return (k - (same.length - 1) / 2) * 11;
  };
  // Rate ticks with decimals from their spacing, so labels never repeat
  // (VND is about 0.00005 SGD per unit).
  const yAxis = useMemo(() => {
    const rates = line.map((p) => p.rate);
    return niceTicks(Math.min(...rates), Math.max(...rates), 4);
  }, [line]);
  const yAxisWidth = Math.max(
    48,
    12 + 7 * (yAxis.ticks.at(-1) ?? 0).toFixed(yAxis.decimals).length,
  );

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 lg:col-span-7">
          <div
            className="h-72 w-full"
            role="img"
            aria-label={`SGD per ${scenario.currency} from ${formatDate(w.start)} to ${formatDate(w.deadline)}, with each strategy's conversion dates. The conversions are listed below.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                key={w.start}
                // No focus stop or assertive live region: the conversions
                // table and the period slider carry the same values (B1).
                accessibilityLayer={false}
                data={line}
                onClick={(st) => coarse && setAt(pointOf(st))}
                onMouseMove={(st) => coarse && setAt(pointOf(st))}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke={AXIS_STROKE} vertical={false} />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) => formatMonth(fromEpochDay(v))}
                  // Clear of the lowest rate label (they overlapped by 1px).
                  tickMargin={8}
                  tick={AXIS_TICK}
                  stroke={AXIS_STROKE}
                  tickCount={5}
                />
                <YAxis
                  domain={yAxis.domain}
                  ticks={yAxis.ticks}
                  tickFormatter={(v: number) => v.toFixed(yAxis.decimals)}
                  tick={AXIS_TICK}
                  stroke={AXIS_STROKE}
                  width={yAxisWidth}
                />
                <Tooltip
                  // Touch: no floating box; the readout below shows the value.
                  // Elsewhere our own box: the day's rate, then each strategy
                  // that converted that day, by name, in the fixed order.
                  content={({ active, label }) =>
                    coarse || !active || label === undefined ? null : (
                      <PathTooltip
                        day={Number(label)}
                        rate={line.find((p) => p.x === Number(label))?.rate}
                        code={scenario.currency}
                        conversions={conversionsOn(Number(label))}
                        formatRate={formatRate}
                      />
                    )
                  }
                />
                {/* Marker area in px²: about 11 px across, above the 8 px minimum. */}
                <ZAxis range={[110, 110]} />
                <Legend
                  // Our own legend, in the fixed strategy order (Recharts
                  // sorted it alphabetically).
                  content={() => <PathLegend code={scenario.currency} />}
                />
                <Line
                  dataKey="rate"
                  name={`SGD per ${scenario.currency}`}
                  stroke="var(--ink)"
                  strokeOpacity={0.6}
                  strokeWidth={LINE_WIDTH}
                  dot={false}
                  isAnimationActive={false}
                  legendType="plainline"
                />
                {STRATEGY_IDS.map((sid) => (
                  <Scatter
                    key={sid}
                    name={STRATEGY_STYLE[sid].label}
                    data={w.results[sid].conversions.map((c) => ({
                      x: toEpochDay(c.date),
                      rate: c.rate,
                      dx: offsetOn(sid, toEpochDay(c.date)),
                    }))}
                    dataKey="rate"
                    fill={STRATEGY_STYLE[sid].color}
                    shape={(p: {
                      cx?: number;
                      cy?: number;
                      payload?: { dx: number };
                    }) => (
                      <PointMark
                        shape={STRATEGY_STYLE[sid].shape}
                        color={STRATEGY_STYLE[sid].color}
                        x={(p.cx ?? 0) + (p.payload?.dx ?? 0)}
                        y={p.cy ?? 0}
                      />
                    )}
                    legendType={STRATEGY_STYLE[sid].shape}
                    isAnimationActive={false}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {coarse && (
            <p
              className="t-small mt-1 min-h-5 tabular-nums"
              aria-live="polite"
              data-testid="rate-readout"
            >
              {at === undefined || !line[at] ? (
                <span className="text-muted-foreground">
                  Tap the chart to read a rate.
                </span>
              ) : (
                <>
                  <span className="font-medium">
                    {formatDate(fromEpochDay(line[at].x))}:
                  </span>{" "}
                  {formatRate(line[at].rate)} SGD per {scenario.currency}
                </>
              )}
            </p>
          )}
        </div>

        <div className="min-w-0 lg:col-span-5">
          {/* Laptops and tablets: a table. */}
          <table className="t-small hidden w-full tabular-nums sm:table">
            <caption className="sr-only">
              Conversions made by each strategy in this period
            </caption>
            <thead className="bg-sunken text-left text-muted-foreground">
              <tr>
                <th
                  scope="col"
                  className="rounded-l-md py-2.5 pr-3 pl-3 font-medium"
                >
                  Strategy
                </th>
                <th scope="col" className="py-2.5 pr-3 font-medium">
                  Converted on
                </th>
                <th scope="col" className="py-2.5 pr-3 text-right font-medium">
                  Cost then
                </th>
                {today && (
                  <th
                    scope="col"
                    className="rounded-r-md py-2.5 pr-3 text-right font-medium"
                  >
                    At {rescaled}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {STRATEGY_IDS.map((sid) => {
                const r = w.results[sid];
                return (
                  <tr key={sid} className="border-b align-top last:border-0">
                    <th
                      scope="row"
                      className="py-2.5 pr-3 pl-3 text-left font-medium"
                    >
                      {STRATEGY_STYLE[sid].label}
                    </th>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      <Conversions
                        list={r.conversions}
                        formatRate={formatRate}
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      {formatSgdAt(r.totalSgd, w.results.lumpSum.totalSgd)}
                    </td>
                    {today && (
                      <td
                        className="py-2.5 pr-3 text-right"
                        data-testid={`detail-today-${sid}`}
                      >
                        {formatSgdAt(today.costs[sid], today.scale)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Phones: one block per strategy, the costs beside its name and
              its conversions under it, date and rate in two columns. */}
          <ul
            className="t-small border-t tabular-nums sm:hidden"
            aria-label="Conversions made by each strategy in this period"
          >
            {STRATEGY_IDS.map((sid) => {
              const r = w.results[sid];
              return (
                <li
                  key={sid}
                  className="border-b py-3"
                  data-testid={`conversions-${sid}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{STRATEGY_STYLE[sid].label}</p>
                    <dl className="text-right">
                      <div>
                        <dt className="sr-only">Cost then</dt>
                        <dd>
                          {formatSgdAt(r.totalSgd, w.results.lumpSum.totalSgd)}{" "}
                          then
                        </dd>
                      </div>
                      {today && (
                        <div className="text-muted-foreground">
                          <dt className="sr-only">At {rescaled}</dt>
                          <dd>
                            {formatSgdAt(today.costs[sid], today.scale)} at{" "}
                            {rescaled}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <Conversions
                    list={r.conversions}
                    formatRate={formatRate}
                    className="mt-1"
                  />
                </li>
              );
            })}
          </ul>
          <p className="t-small mt-3 text-muted-foreground">
            Cost then: the SGD actually paid in that period, at that time&apos;s
            rates, plus your exchange fee.
            {today &&
              ` At ${rescaled}: the same period rescaled, as on the timeline above.`}{" "}
            The target was {formatRate(w.spot * (1 - targetBelowSpot))} (
            {formatPct(targetBelowSpot)} below {formatRate(w.spot)}).
          </p>
        </div>
      </div>
    </div>
  );
});

/** One conversion per line: its date, then its rate in a column of its own. */
function Conversions({
  list,
  formatRate,
  className = "",
}: {
  list: { date: string; rate: number }[];
  formatRate: (r: number) => string;
  className?: string;
}) {
  return (
    <ul className={`text-muted-foreground ${className}`}>
      {list.map((c) => (
        <li key={c.date} className="grid grid-cols-[6.75rem_auto] gap-x-3">
          <span className="whitespace-nowrap">{formatDate(c.date)}</span>
          <span className="whitespace-nowrap">{formatRate(c.rate)}</span>
        </li>
      ))}
    </ul>
  );
}

/** The chart's active point from a Recharts event, if any. */
function pointOf(
  st: { activeTooltipIndex?: number | string | null } | null | undefined,
) {
  const i = st?.activeTooltipIndex;
  return i === null || i === undefined ? undefined : Number(i);
}

/** The rate line, then the four strategies in the fixed order (DESIGN.md §1). */
function PathLegend({ code }: { code: string }) {
  return (
    <ChartLegend
      className="pt-2"
      items={[
        {
          key: "rate",
          label: `SGD per ${code}`,
          color: "var(--ink)",
          mark: "line",
          muted: true,
        },
        ...STRATEGY_IDS.map((sid) => ({
          key: sid,
          label: STRATEGY_STYLE[sid].label,
          color: STRATEGY_STYLE[sid].color,
          mark: STRATEGY_STYLE[sid].shape,
        })),
      ]}
    />
  );
}

/**
 * The day under the pointer: its rate, and each strategy that converted on
 * it, named (colour is never the only cue) and in ink, so the text keeps
 * its contrast (B2).
 */
function PathTooltip({
  day,
  rate,
  code,
  conversions,
  formatRate,
}: {
  day: number;
  rate?: number;
  code: string;
  conversions: { sid: (typeof STRATEGY_IDS)[number]; rate: number }[];
  formatRate: (r: number) => string;
}) {
  return (
    <div className="t-small rounded-lg border bg-surface p-3 text-ink shadow-[var(--shadow-pop)] tabular-nums">
      <p className="font-medium">{formatDate(fromEpochDay(day))}</p>
      {rate !== undefined && (
        <p className="mt-1">
          {formatRate(rate)} SGD per {code}
        </p>
      )}
      {conversions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {conversions.map(({ sid, rate: r }) => (
            <li key={sid} className="flex items-center gap-2">
              <Marker
                shape={STRATEGY_STYLE[sid].shape}
                color={STRATEGY_STYLE[sid].color}
              />
              {STRATEGY_STYLE[sid].label} converted at {formatRate(r)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
