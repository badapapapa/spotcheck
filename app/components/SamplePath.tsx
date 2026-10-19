"use client";

import { Download } from "lucide-react";
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
import { sampleWindow } from "@/engine/replay.ts";
import { STRATEGY_IDS, type Scenario, type Series } from "@/engine/types.ts";
import { formatDate, formatMonth } from "@/lib/dates.ts";
import { formatRate, formatSgd } from "@/lib/format.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { niceTicks } from "@/lib/ticks.ts";
import { Button } from "@/components/ui/button";

type Props = {
  fx: Series;
  scenario: Scenario;
  targetBelowSpot: number;
  startDates: string[];
};

/** One historical window: the rate line, and where each strategy converted. */
export function SamplePath({
  fx,
  scenario,
  targetBelowSpot,
  startDates,
}: Props) {
  const id = useId();
  const [index, setIndex] = useState(startDates.length - 1);
  const [exporting, setExporting] = useState(false);
  const start = startDates[Math.min(index, startDates.length - 1)]!;
  const w = useMemo(
    () => sampleWindow(fx, scenario, start, { targetBelowSpot }),
    [fx, scenario, start, targetBelowSpot],
  );

  async function exportXlsx() {
    setExporting(true);
    try {
      // Loaded on demand: ExcelJS is large and most visitors never export.
      const { downloadWorkbook } = await import("@/lib/xlsx.ts");
      await downloadWorkbook(fx, scenario, targetBelowSpot, w);
    } finally {
      setExporting(false);
    }
  }

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
        <label htmlFor={`${id}-start`} className="text-sm font-medium">
          Window starting {formatDate(w.start)}
        </label>
        <input
          id={`${id}-start`}
          type="range"
          min={0}
          max={startDates.length - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={formatDate(start)}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatMonth(startDates[0]!)}</span>
          <span>{formatMonth(startDates.at(-1)!)}</span>
        </div>
      </div>

      <div
        className="h-72 w-full"
        role="img"
        aria-label={`SGD per ${scenario.currency} from ${formatDate(w.start)} to ${formatDate(w.deadline)}, with each strategy's conversion dates. The conversions are listed below.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={line}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v: number) => formatMonth(fromEpochDay(v))}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              stroke="var(--border)"
              tickCount={5}
            />
            <YAxis
              domain={yAxis.domain}
              ticks={yAxis.ticks}
              tickFormatter={(v: number) => v.toFixed(yAxis.decimals)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              stroke="var(--border)"
              width={yAxisWidth}
            />
            <Tooltip
              labelFormatter={(v) => formatDate(fromEpochDay(Number(v)))}
              formatter={(v) => [
                formatRate(Number(v)),
                `SGD per ${scenario.currency}`,
              ]}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
              }}
            />
            {/* Marker area in px²: about 11 px across, above the 8 px minimum. */}
            <ZAxis range={[110, 110]} />
            <Legend
              wrapperStyle={{ fontSize: 13, color: "var(--foreground)" }}
            />
            <Line
              dataKey="rate"
              name={`SGD per ${scenario.currency}`}
              stroke="var(--foreground)"
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
                stroke="var(--background)"
                strokeWidth={1.5}
                shape={STRATEGY_STYLE[sid].shape}
                legendType={STRATEGY_STYLE[sid].shape}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm tabular-nums">
          <caption className="sr-only">
            Conversions made by each strategy in this window
          </caption>
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 font-medium">
                Strategy
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Converted on
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Total cost
              </th>
            </tr>
          </thead>
          <tbody>
            {STRATEGY_IDS.map((sid) => {
              const r = w.results[sid];
              return (
                <tr
                  key={sid}
                  className="border-b border-border align-top last:border-0"
                >
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    {STRATEGY_STYLE[sid].label}
                  </th>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {r.conversions
                      .map(
                        (c) => `${formatDate(c.date)} at ${formatRate(c.rate)}`,
                      )
                      .join("; ")}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {formatSgd(r.totalSgd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          Actual SGD paid in that window, at that time&apos;s rates, plus your
          spread. The target was {formatRate(w.spot * (1 - targetBelowSpot))} (
          {(targetBelowSpot * 100).toFixed(1)}% below {formatRate(w.spot)}).
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={exportXlsx}
          disabled={exporting}
        >
          <Download aria-hidden />
          {exporting
            ? "Preparing…"
            : "Download this window as .xlsx (live formulas)"}
        </Button>
      </div>
    </div>
  );
}
