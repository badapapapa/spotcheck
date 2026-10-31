"use client";

import { useId, useMemo, useState } from "react";
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
import { STRATEGY_IDS, type Scenario, type Series } from "@/engine/types.ts";
import { formatDate, formatMonth } from "@/lib/dates.ts";
import { formatPct, formatRate, formatSgdAt } from "@/lib/format.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { niceTicks } from "@/lib/ticks.ts";
import { useCoarsePointer } from "@/lib/use-coarse-pointer.ts";

export type Window = ReturnType<typeof sampleWindow>;

type Props = {
  fx: Series;
  scenario: Scenario;
  targetBelowSpot: number;
  startDates: string[];
  /** The selected window. The planner owns it so Download Excel can export it. */
  index: number;
  onIndex: (index: number) => void;
  window: Window;
};

/** One historical window: the rate line, and where each strategy converted. */
export function SamplePath({
  fx,
  scenario,
  targetBelowSpot,
  startDates,
  index,
  onIndex,
  window: w,
}: Props) {
  const id = useId();
  const coarse = useCoarsePointer();
  // The point last tapped, for the touch readout under the chart.
  const [at, setAt] = useState<number | undefined>();
  const start = startDates[index]!;

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
    <div className="space-y-4">
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-start`} className="t-small font-medium">
          Start of the period: {formatDate(w.start)}
        </label>
        <input
          id={`${id}-start`}
          type="range"
          min={0}
          max={startDates.length - 1}
          value={index}
          onChange={(e) => onIndex(Number(e.target.value))}
          aria-valuetext={formatDate(start)}
          className="h-11 w-full"
        />
        <div className="t-label flex justify-between">
          <span>{formatMonth(startDates[0]!)}</span>
          <span>{formatMonth(startDates.at(-1)!)}</span>
        </div>
      </div>

      <div className="grid gap-8 pt-2 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7">
          <div
            className="h-72 w-full"
            role="img"
            aria-label={`SGD per ${scenario.currency} from ${formatDate(w.start)} to ${formatDate(w.deadline)}, with each strategy's conversion dates. The conversions are listed below.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={line}
                onClick={(st) => coarse && setAt(pointOf(st))}
                onMouseMove={(st) => coarse && setAt(pointOf(st))}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke="var(--rule)" vertical={false} />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) => formatMonth(fromEpochDay(v))}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  stroke="var(--rule)"
                  tickCount={5}
                />
                <YAxis
                  domain={yAxis.domain}
                  ticks={yAxis.ticks}
                  tickFormatter={(v: number) => v.toFixed(yAxis.decimals)}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  stroke="var(--rule)"
                  width={yAxisWidth}
                />
                <Tooltip
                  separator=": "
                  // Touch: no floating box; the readout below shows the value.
                  content={coarse ? () => null : undefined}
                  labelFormatter={(v) => formatDate(fromEpochDay(Number(v)))}
                  formatter={(v) => [
                    formatRate(Number(v)),
                    `SGD per ${scenario.currency}`,
                  ]}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--rule)",
                    borderRadius: 8,
                    color: "var(--ink)",
                    fontSize: 13,
                  }}
                />
                {/* Marker area in px²: about 11 px across, above the 8 px minimum. */}
                <ZAxis range={[110, 110]} />
                <Legend
                  wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
                  // Names in ink; the marker beside each carries the colour.
                  formatter={(name) => (
                    <span style={{ color: "var(--muted)" }}>{name}</span>
                  )}
                />
                <Line
                  dataKey="rate"
                  name={`SGD per ${scenario.currency}`}
                  stroke="var(--ink)"
                  strokeOpacity={0.6}
                  strokeWidth={2}
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
                    }))}
                    dataKey="rate"
                    fill={STRATEGY_STYLE[sid].color}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    shape={STRATEGY_STYLE[sid].shape}
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

        <div className="lg:col-span-5">
          <table className="t-small w-full tabular-nums">
            <caption className="sr-only">
              Conversions made by each strategy in this window
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
                <th
                  scope="col"
                  className="rounded-r-md py-2.5 pr-3 text-right font-medium"
                >
                  Total cost
                </th>
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
                      {/* One conversion per line: date · rate. */}
                      <ul>
                        {r.conversions.map((c) => (
                          <li key={c.date} className="whitespace-nowrap">
                            {formatDate(c.date)} · {formatRate(c.rate)}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      {formatSgdAt(r.totalSgd, w.results.lumpSum.totalSgd)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="t-small mt-3 text-muted-foreground">
            Actual SGD paid in that window, at that time&apos;s rates, plus your
            spread. The target was {formatRate(w.spot * (1 - targetBelowSpot))}{" "}
            ({formatPct(targetBelowSpot)} below {formatRate(w.spot)}).
          </p>
        </div>
      </div>
    </div>
  );
}

/** The chart's active point from a Recharts event, if any. */
function pointOf(
  st: { activeTooltipIndex?: number | string | null } | null | undefined,
) {
  const i = st?.activeTooltipIndex;
  return i === null || i === undefined ? undefined : Number(i);
}
