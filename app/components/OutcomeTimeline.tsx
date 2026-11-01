"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toEpochDay } from "@/engine/calendar.ts";
import type { ReplayResult } from "@/engine/replay.ts";
import { STRATEGY_IDS, type StrategyId } from "@/engine/types.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatSgd, formatSgdAt } from "@/lib/format.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { niceTicks, sgdTickDecimals } from "@/lib/ticks.ts";
import { stepMonth } from "@/lib/periods.ts";
import { useWidth } from "@/lib/use-width.ts";
import { LineMark } from "./ChartLegend";

// Right padding keeps the latest period's marker off the plot's edge.
const PAD = { top: 12, right: 16, bottom: 28 };
const subscribeResize = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};
const viewportHeight = () => window.innerHeight;

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
  /** What costs are rescaled to: "today's rate", "the rate on 2 Jan 2025". */
  rescaled?: string;
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
 * The chart is the one control for picking a period: a slider for the
 * keyboard, and drag (or tap) to scrub with a pointer, which updates the
 * detail below as it goes. Hovering previews a period. One marker shows the
 * period in question, and a readout row above the chart gives its date and
 * all four costs, so nothing floats over the lines.
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
  rescaled = "today's rate",
}: Props) {
  const id = useId();
  const [ref, measured] = useWidth<HTMLDivElement>();
  const W = Math.max(280, measured);
  const monthly = W < MONTHLY_BELOW;
  // Fits between the fixed bars, a landscape phone included: the legend
  // and readout take about 110px, the tab bar 56.
  const vh = useSyncExternalStore(subscribeResize, viewportHeight, () => 900);
  const H = Math.min(monthly ? 280 : 300, Math.max(200, vh - 170));
  // The bucket under the pointer (a month on phones, a day on laptops),
  // shown as a preview; null when the pointer is elsewhere.
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
    // Fitted to the data with a 5% margin, not stretched to whole tick
    // steps, so the lines fill the chart; round ticks inside that range.
    // A flat history (the BND peg: every period costs the same) has no
    // range to fit, so it gets a small band; a zero-height domain would
    // divide by zero and draw nothing (NaN paths).
    const span = (hi - lo) * scale;
    const pad =
      span > 0 ? span * 0.05 : Math.max(Math.abs(lo * scale) * 0.01, 1);
    const domain: [number, number] = [lo * scale - pad, hi * scale + pad];
    const nice = niceTicks(lo * scale, hi * scale, 6);
    return {
      ...nice,
      domain,
      ticks: nice.ticks.filter((t) => t >= domain[0] && t <= domain[1]),
    };
  }, [result.relativeCosts, scale]);
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

  // Year ticks: about one per 80px.
  const years = useMemo(() => {
    const first = Number(result.startDates[0]!.slice(0, 4)) + 1;
    const last = Number(result.startDates.at(-1)!.slice(0, 4));
    const step = Math.max(
      1,
      Math.ceil((last - first + 1) / ((W - plotL) / 80)),
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

  const label = (id: StrategyId) => STRATEGY_STYLE[id].label;
  // One marker: where the pointer is (a preview), otherwise the selected
  // period. It always stands on a real daily period, so the readout's
  // figures are that period's, on phones too.
  const shown = hover === null ? selected : periodOf(hover);
  const last = result.startDates.length - 1;

  /** Everything the readout shows, also spoken as the slider's value. */
  const valueText = (i: number) =>
    `${formatDate(result.startDates[i]!)}: ` +
    STRATEGY_IDS.map(
      (id) => `${label(id)} ${formatSgdAt(cost(id, i), scale)}`,
    ).join(", ");

  function onKeyDown(e: React.KeyboardEvent) {
    const step: Record<string, () => number> = {
      ArrowRight: () => Math.min(last, selected + 1),
      ArrowUp: () => Math.min(last, selected + 1),
      ArrowLeft: () => Math.max(0, selected - 1),
      ArrowDown: () => Math.max(0, selected - 1),
      PageUp: () => stepMonth(result.startDates, selected, 1),
      PageDown: () => stepMonth(result.startDates, selected, -1),
      Home: () => 0,
      End: () => last,
    };
    const next = step[e.key];
    if (!next) return;
    e.preventDefault();
    setHover(null);
    onSelect(next());
  }

  /** Drag to scrub: the selection follows the pointer while it is down. */
  function scrub(e: React.PointerEvent<SVGSVGElement>) {
    const i = periodOf(indexAt(e.clientX, e.currentTarget));
    if (i !== selected) onSelect(i);
  }

  return (
    <div>
      {/* The readout and the legend in one: the marked period's date, then
          each strategy, in the fixed order, with its cost that period.
          Hover or focus previews a strategy, a click locks it, and "Show
          all strategies" (or Esc) unlocks it. Nothing floats over the lines,
          and text never fades (DESIGN.md §6). */}
      <p
        className="t-small min-h-5 font-medium text-ink tabular-nums"
        data-testid="timeline-readout"
      >
        {hover !== null && shown !== selected ? "Pointing at" : "Selected"}: the
        period starting{" "}
        <span data-testid="readout-date">
          {formatDate(result.startDates[shown]!)}
        </span>
      </p>
      <ul className="mt-1 mb-3 grid grid-cols-2 gap-x-1 sm:flex sm:flex-wrap sm:gap-x-2">
        {STRATEGY_IDS.map((id) => (
          <li key={id} data-dimmed={(active && active !== id) || undefined}>
            <button
              type="button"
              aria-pressed={pinned === id}
              onMouseEnter={() => onActive(id)}
              onMouseLeave={() => onActive(null)}
              onFocus={() => onActive(id)}
              onBlur={() => onActive(null)}
              onClick={() => onToggle(id)}
              className="t-small flex min-h-11 w-full items-center gap-2 rounded-sm px-2 text-left text-muted-foreground transition-colors hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink"
            >
              <LineMark color={STRATEGY_STYLE[id].color} />
              <span className="flex flex-col sm:flex-row sm:gap-2">
                <span data-testid="legend-name">{label(id)}</span>
                <span
                  className="text-ink tabular-nums"
                  data-testid={`readout-${id}`}
                >
                  {formatSgdAt(cost(id, shown), scale)}
                </span>
              </span>
            </button>
          </li>
        ))}
        {pinned && (
          <li className="col-span-2">
            <button
              type="button"
              onClick={() => onToggle(pinned)}
              className="link t-small flex min-h-11 items-center px-2"
              data-testid="show-all"
            >
              Show all strategies
            </button>
          </li>
        )}
      </ul>

      {/* The chart is the period slider: arrows a day, Page Up/Down a
          month, Home/End the ends; drag (or tap) to pick with a pointer. */}
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Start of the period"
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={selected}
        aria-valuetext={valueText(selected)}
        aria-describedby={`${id}-desc`}
        onKeyDown={onKeyDown}
        className="relative rounded-sm"
        data-testid="timeline"
      >
        <p id={`${id}-desc`} className="sr-only">
          Cost of each strategy at {rescaled}, for every period starting{" "}
          {formatDate(result.firstStart)} to {formatDate(result.lastStart)}
          {monthly ? ", grouped by month" : ""}. Arrow keys move a day, Page Up
          and Page Down a month, Home and End to the first and last period.
        </p>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          // Drawn at the measured width, so it never scales down (Safari
          // shrank it to about 170px tall when it did).
          style={{ width: "100%", height: H }}
          className="block touch-pan-y select-none"
          aria-hidden
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            setHover(null);
            scrub(e);
          }}
          onPointerMove={(e) => {
            if (dragging.current) scrub(e);
            else if (e.pointerType === "mouse")
              setHover(indexAt(e.clientX, e.currentTarget));
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerLeave={() => {
            if (!dragging.current) setHover(null);
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
                className="fill-muted-foreground text-chart tabular-nums"
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
              className="fill-muted-foreground text-chart tabular-nums"
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

          {/* The one marker, the spot motif (DESIGN.md §5): a hairline at
              the marked period with a dot on each line. */}
          <g pointerEvents="none" data-testid="marker">
            <line
              x1={x(days[shown]!)}
              x2={x(days[shown]!)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--accent)"
              strokeWidth={1.5}
            />
            {STRATEGY_IDS.map((id) => (
              <circle
                key={id}
                cx={x(days[shown]!)}
                cy={y(cost(id, shown))}
                r={4.5}
                fill={STRATEGY_STYLE[id].color}
                stroke="var(--surface)"
                strokeWidth={2}
                opacity={active && active !== id ? 0.3 : 1}
              />
            ))}
          </g>
        </svg>
      </div>

      {monthly && (
        <>
          <p className="t-small mt-2 text-muted-foreground">
            Each band is a month&apos;s lowest to highest cost; the line is its
            median. Every daily period is still in the calculation and the
            export.
          </p>
          {/* Large targets for stepping a month at a time on a phone, side
              by side, wrapping only on the narrowest screens. */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 [&>button]:grow">
            <button
              type="button"
              className="btn-secondary"
              disabled={stepMonth(result.startDates, selected, -1) === selected}
              onClick={() =>
                onSelect(stepMonth(result.startDates, selected, -1))
              }
            >
              <ChevronLeft aria-hidden className="size-4" />
              Earlier month
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={stepMonth(result.startDates, selected, 1) === selected}
              onClick={() =>
                onSelect(stepMonth(result.startDates, selected, 1))
              }
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
