"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toEpochDay } from "@/engine/calendar.ts";
import type { ReplayResult } from "@/engine/replay.ts";
import { STRATEGY_IDS, type StrategyId } from "@/engine/types.ts";
import { formatDate, formatMonth } from "@/lib/dates.ts";
import { formatSgd } from "@/lib/format.ts";
import { signedSgd } from "@/lib/signed.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { niceTicks, sgdTickDecimals } from "@/lib/ticks.ts";
import { useWidth } from "@/lib/use-width.ts";

const PAD = { top: 12, right: 8, bottom: 28 };
/** Below this chart width (phones), periods are grouped by month. */
const MONTHLY_BELOW = 640;

type Props = {
  result: ReplayResult;
  /** The user's amount: the replay's relative costs × amount × today's rate. */
  amount: number;
  selected: number;
  onSelect: (index: number) => void;
  /** Highlighted now (hovered or pinned): the others dim. */
  active: string | null;
  /** Pinned by a click: the only state a legend button reports as pressed. */
  pinned: string | null;
  onActive: (id: string | null) => void;
  onToggle: (id: string) => void;
};

/** Periods grouped by the month they start in, for the phone view. */
type Month = {
  key: string;
  /** First and last period index in the month. */
  from: number;
  to: number;
  /** Midpoint, in epoch days, where the month is drawn. */
  day: number;
  low: Record<StrategyId, number>;
  high: Record<StrategyId, number>;
  median: Record<StrategyId, number>;
};

/**
 * Every past period on one chart (DESIGN.md §6): what each strategy would
 * have cost, at today's rate, starting on each day. The same calculation
 * drives every view; only the drawing differs by screen size:
 *
 * - laptops: every daily period, drawn as each pixel column's low and high,
 *   so no spike is lost;
 * - phones: one point per month: a band from that month's lowest to highest
 *   cost and a line through its median, with larger targets to step between
 *   months.
 *
 * Hovering or dragging moves the spot cursor; clicking or lifting selects a
 * period for the detail below. The period slider under the chart is the
 * keyboard control for the same selection.
 */
export function OutcomeTimeline({
  result,
  amount,
  selected,
  onSelect,
  active,
  pinned,
  onActive,
  onToggle,
}: Props) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const W = Math.max(280, measured);
  const monthly = W < MONTHLY_BELOW;
  const H = monthly ? 220 : 280;
  const [hover, setHover] = useState<number | null>(null);
  const dragging = useRef(false);

  const scale = amount * result.referenceSpot;
  const days = useMemo(
    () => result.startDates.map((d) => toEpochDay(d)),
    [result.startDates],
  );
  const cost = (id: StrategyId, i: number) =>
    result.relativeCosts[id][i]! * scale;

  const months = useMemo(
    () => groupByMonth(result, days, scale),
    [result, days, scale],
  );

  const axis = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const id of STRATEGY_IDS)
      for (const c of result.relativeCosts[id]) {
        if (c < lo) lo = c;
        if (c > hi) hi = c;
      }
    return niceTicks(lo * scale, hi * scale, monthly ? 3 : 4);
  }, [result.relativeCosts, scale, monthly]);
  const decimals = sgdTickDecimals(axis);
  const yLabelW = Math.max(
    44,
    8 + 7.2 * formatSgd(axis.ticks.at(-1) ?? 0, { decimals }).length,
  );
  const plotL = yLabelW + 8;
  const plotR = W - PAD.right;
  const d0 = days[0]!;
  const d1 = days.at(-1)!;
  const x = (day: number) =>
    plotL + ((day - d0) / Math.max(1, d1 - d0)) * (plotR - plotL);
  const y = (v: number) =>
    PAD.top +
    (1 - (v - axis.domain[0]) / (axis.domain[1] - axis.domain[0])) *
      (H - PAD.top - PAD.bottom);

  // Laptops: ~7,000 points per line, drawn as each pixel column's low and
  // high, which keeps every spike and stays fast.
  const daily = useMemo(() => {
    if (monthly) return null;
    const out = {} as Record<StrategyId, string>;
    for (const id of STRATEGY_IDS) {
      const series = result.relativeCosts[id];
      let d = "";
      let col = -1;
      let min = 0;
      let max = 0;
      const flush = () => {
        if (col < 0) return;
        d += `${d ? "L" : "M"}${col},${y(min * scale).toFixed(1)}`;
        if (max !== min) d += `L${col},${y(max * scale).toFixed(1)}`;
      };
      for (let i = 0; i < series.length; i++) {
        const c = Math.round(x(days[i]!));
        const v = series[i]!;
        if (c !== col) {
          flush();
          col = c;
          min = max = v;
        } else {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      flush();
      out[id] = d;
    }
    return out;
    // x and y depend only on these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly, result.relativeCosts, days, W, H, axis, scale]);

  // Phones: each month's low–high band and a median line.
  const bands = useMemo(() => {
    if (!monthly) return null;
    const out = {} as Record<StrategyId, { band: string; line: string }>;
    for (const id of STRATEGY_IDS) {
      const top = months.map(
        (m) => `${x(m.day).toFixed(1)},${y(m.high[id]).toFixed(1)}`,
      );
      const bottom = months
        .map((m) => `${x(m.day).toFixed(1)},${y(m.low[id]).toFixed(1)}`)
        .reverse();
      out[id] = {
        band: `M${top.join("L")}L${bottom.join("L")}Z`,
        line: `M${months.map((m) => `${x(m.day).toFixed(1)},${y(m.median[id]).toFixed(1)}`).join("L")}`,
      };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly, months, W, H, axis]);

  // Year ticks: about one per 110px.
  const years = useMemo(() => {
    const first = Number(result.startDates[0]!.slice(0, 4)) + 1;
    const last = Number(result.startDates.at(-1)!.slice(0, 4));
    const step = Math.max(
      1,
      Math.ceil((last - first + 1) / ((W - plotL) / 110)),
    );
    const out: number[] = [];
    for (let yr = first; yr <= last; yr += step) out.push(yr);
    return out;
  }, [result.startDates, W, plotL]);

  /** The period (laptops) or month (phones) nearest to a pointer position. */
  function indexAt(clientX: number, el: Element): number {
    const box = el.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * W;
    const day = d0 + ((px - plotL) / (plotR - plotL)) * (d1 - d0);
    if (monthly) {
      let nearest = 0;
      for (let m = 1; m < months.length; m++)
        if (
          Math.abs(months[m]!.day - day) < Math.abs(months[nearest]!.day - day)
        )
          nearest = m;
      return nearest;
    }
    let lo = 0;
    let hi = days.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (days[mid]! < day) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && day - days[lo - 1]! < days[lo]! - day) lo--;
    return Math.max(0, Math.min(days.length - 1, lo));
  }
  /** Selecting a month selects the period in its middle. */
  const periodOf = (i: number) =>
    monthly ? (months[i]!.from + months[i]!.to) >> 1 : i;
  const monthOf = (period: number) =>
    Math.max(
      0,
      months.findIndex((m) => period >= m.from && period <= m.to),
    );

  const label = (id: StrategyId) => STRATEGY_STYLE[id].label;
  const shown = hover;
  const shownDay =
    shown === null ? 0 : monthly ? months[shown]!.day : days[shown]!;
  const value = (id: StrategyId, i: number) =>
    monthly ? months[i]!.median[id] : cost(id, i);
  const tipLeft = shown !== null && x(shownDay) > W * 0.55;
  const selectedMonth = monthOf(selected);

  return (
    <div>
      {/* Legend: hover to preview a strategy, click to pin it. */}
      <ul className="mb-3 flex flex-wrap gap-x-1 gap-y-0">
        {STRATEGY_IDS.map((id) => (
          <li key={id}>
            <button
              type="button"
              aria-pressed={pinned === id}
              onMouseEnter={() => onActive(id)}
              onMouseLeave={() => onActive(null)}
              onFocus={() => onActive(id)}
              onBlur={() => onActive(null)}
              onClick={() => onToggle(id)}
              className="t-small flex min-h-11 items-center gap-2 rounded-sm px-2 text-muted-foreground transition-colors hover:text-ink aria-pressed:bg-sunken aria-pressed:text-ink"
            >
              <span
                aria-hidden
                className="h-0.5 w-4 rounded-full"
                style={{ background: STRATEGY_STYLE[id].color }}
              />
              {label(id)}
            </button>
          </li>
        ))}
      </ul>

      <div ref={ref} className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block max-w-full touch-pan-y select-none"
          role="img"
          aria-label={`Cost of each strategy at today's rate, for every period starting ${formatDate(result.firstStart)} to ${formatDate(result.lastStart)}${monthly ? ", grouped by month" : ""}. The selected period starts ${formatDate(result.startDates[selected]!)}. Use the period slider below to pick another.`}
          onPointerMove={(e) => {
            if (e.pointerType === "touch" && !dragging.current) return;
            setHover(indexAt(e.clientX, e.currentTarget));
          }}
          onPointerDown={(e) => {
            dragging.current = true;
            setHover(indexAt(e.clientX, e.currentTarget));
          }}
          onPointerUp={(e) => {
            dragging.current = false;
            onSelect(periodOf(indexAt(e.clientX, e.currentTarget)));
            if (e.pointerType === "touch") setHover(null);
          }}
          onPointerLeave={() => {
            dragging.current = false;
            setHover(null);
          }}
          onPointerCancel={() => {
            dragging.current = false;
            setHover(null);
          }}
        >
          {axis.ticks.map((t) => (
            <g key={t}>
              <line
                x1={plotL}
                x2={plotR}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--rule)"
              />
              <text
                x={yLabelW}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[12px] tabular-nums"
              >
                {formatSgd(t, { decimals })}
              </text>
            </g>
          ))}
          {years.map((yr) => (
            <text
              key={yr}
              x={x(toEpochDay(`${yr}-01-01`))}
              y={H - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[12px] tabular-nums"
            >
              {yr}
            </text>
          ))}

          {STRATEGY_IDS.map((id) => {
            const dim = active !== null && active !== id;
            const style = {
              transition: "opacity var(--fast) var(--ease)",
            };
            return bands ? (
              <g key={id} style={{ ...style, opacity: dim ? 0.15 : 1 }}>
                <path
                  d={bands[id].band}
                  fill={STRATEGY_STYLE[id].color}
                  opacity={0.24}
                />
                <path
                  d={bands[id].line}
                  fill="none"
                  stroke={STRATEGY_STYLE[id].color}
                  strokeWidth={1.75}
                  strokeLinejoin="round"
                />
              </g>
            ) : (
              <path
                key={id}
                d={daily![id]}
                fill="none"
                stroke={STRATEGY_STYLE[id].color}
                strokeWidth={id === "lumpSum" ? 1.5 : 1.25}
                strokeLinejoin="round"
                style={{ ...style, opacity: dim ? 0.15 : 0.9 }}
              />
            );
          })}

          {/* The selected period: the spot motif, in the accent colour. */}
          <g aria-hidden>
            <line
              x1={x(days[selected]!)}
              x2={x(days[selected]!)}
              y1={PAD.top - 4}
              y2={H - PAD.bottom}
              stroke="var(--accent)"
              strokeWidth={1.5}
            />
            <circle
              cx={x(days[selected]!)}
              cy={PAD.top - 4}
              r={4}
              fill="var(--accent)"
            />
          </g>

          {/* The hover cursor: a hairline and a dot on each line. */}
          {shown !== null && (
            <g aria-hidden pointerEvents="none">
              <line
                x1={x(shownDay)}
                x2={x(shownDay)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--ink)"
                strokeWidth={1}
              />
              {STRATEGY_IDS.map((id) => (
                <circle
                  key={id}
                  cx={x(shownDay)}
                  cy={y(value(id, shown))}
                  r={4}
                  fill={STRATEGY_STYLE[id].color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  opacity={active && active !== id ? 0.3 : 1}
                />
              ))}
            </g>
          )}
        </svg>

        {shown !== null && (
          <div
            aria-hidden
            className="t-small pointer-events-none absolute top-2 z-10 w-64 rounded-lg border bg-surface p-3 shadow-[var(--shadow-pop)]"
            style={
              tipLeft
                ? { right: Math.max(0, W - x(shownDay) + 12) }
                : { left: Math.min(x(shownDay) + 12, W - 256) }
            }
          >
            <p className="font-medium">
              {monthly
                ? `Periods starting in ${formatMonth(result.startDates[months[shown]!.from]!)}`
                : `Starting ${formatDate(result.startDates[shown]!)}`}
            </p>
            <table className="mt-2 w-full tabular-nums">
              <thead className="text-[12px] text-muted-foreground">
                <tr>
                  <th className="text-left font-normal">
                    {monthly ? "Median that month" : "Cost"}
                  </th>
                  <th className="text-right font-normal" />
                  <th className="text-right font-normal">vs all at once</th>
                </tr>
              </thead>
              <tbody>
                {STRATEGY_IDS.map((id) => (
                  <tr key={id}>
                    <td className="flex items-center gap-2 py-0.5 text-muted-foreground">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: STRATEGY_STYLE[id].color }}
                      />
                      {label(id)}
                    </td>
                    <td className="pl-2 text-right">
                      {formatSgd(value(id, shown))}
                    </td>
                    <td className="pl-2 text-right text-muted-foreground">
                      {id === "lumpSum"
                        ? "–"
                        : signedSgd(value(id, shown) - value("lumpSum", shown))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {monthly && (
        <>
          <p className="t-small mt-2 text-muted-foreground">
            Each band is a month&apos;s lowest to highest cost; the line is its
            median. Every daily period is still in the calculation and the
            export.
          </p>
          {/* Large targets for stepping a month at a time on a phone. */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn-secondary"
              disabled={selectedMonth <= 0}
              onClick={() => onSelect(periodOf(selectedMonth - 1))}
            >
              <ChevronLeft aria-hidden className="size-4" />
              Earlier month
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={selectedMonth >= months.length - 1}
              onClick={() => onSelect(periodOf(selectedMonth + 1))}
            >
              Later month
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Groups the periods by the calendar month they start in, keeping each
 * strategy's lowest, highest and median cost per month. Display only: the
 * selection, the detail and the export all use the daily periods.
 */
function groupByMonth(
  result: ReplayResult,
  days: number[],
  scale: number,
): Month[] {
  const out: Month[] = [];
  let from = 0;
  const dates = result.startDates;
  for (let i = 1; i <= dates.length; i++) {
    if (i < dates.length && dates[i]!.slice(0, 7) === dates[from]!.slice(0, 7))
      continue;
    const low = {} as Record<StrategyId, number>;
    const high = {} as Record<StrategyId, number>;
    const median = {} as Record<StrategyId, number>;
    for (const id of STRATEGY_IDS) {
      const vals = result.relativeCosts[id]
        .slice(from, i)
        .map((v) => v * scale)
        .sort((a, b) => a - b);
      low[id] = vals[0]!;
      high[id] = vals.at(-1)!;
      const mid = vals.length >> 1;
      median[id] =
        vals.length % 2 ? vals[mid]! : (vals[mid - 1]! + vals[mid]!) / 2;
    }
    out.push({
      key: dates[from]!.slice(0, 7),
      from,
      to: i - 1,
      day: (days[from]! + days[i - 1]!) / 2,
      low,
      high,
      median,
    });
    from = i;
  }
  return out;
}
