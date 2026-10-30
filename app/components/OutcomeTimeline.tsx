"use client";

import { useMemo, useRef, useState } from "react";
import { toEpochDay } from "@/engine/calendar.ts";
import type { ReplayResult } from "@/engine/replay.ts";
import { STRATEGY_IDS, type StrategyId } from "@/engine/types.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatSgd } from "@/lib/format.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { niceTicks, sgdTickDecimals } from "@/lib/ticks.ts";
import { useWidth } from "@/lib/use-width.ts";

const PAD = { top: 12, right: 8, bottom: 28 };

type Props = {
  result: ReplayResult;
  /** The user's amount: the replay's relative costs × amount × today's rate. */
  amount: number;
  selected: number;
  onSelect: (index: number) => void;
  active: string | null;
  onActive: (id: string | null) => void;
  /** The pair the headline compares, shown as the tooltip's last row. */
  compare: { a: StrategyId; b: StrategyId };
};

/**
 * Every past period on one chart (DESIGN.md §6): for each start date, what
 * each strategy would have cost at today's rate. Hovering (or dragging on a
 * touch screen) moves the spot cursor and shows that period's costs;
 * clicking or lifting selects it for the detail below. The period slider
 * under the chart is the keyboard control for the same selection.
 */
export function OutcomeTimeline({
  result,
  amount,
  selected,
  onSelect,
  active,
  onActive,
  compare,
}: Props) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const W = Math.max(280, measured);
  const narrow = W < 640;
  const H = narrow ? 220 : 280;
  const [hover, setHover] = useState<number | null>(null);
  const dragging = useRef(false);

  const scale = amount * result.referenceSpot;
  const days = useMemo(
    () => result.startDates.map((d) => toEpochDay(d)),
    [result.startDates],
  );
  const cost = (id: StrategyId, i: number) =>
    result.relativeCosts[id][i]! * scale;

  const axis = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const id of STRATEGY_IDS)
      for (const c of result.relativeCosts[id]) {
        if (c < lo) lo = c;
        if (c > hi) hi = c;
      }
    return niceTicks(lo * scale, hi * scale, narrow ? 3 : 4);
  }, [result.relativeCosts, scale, narrow]);
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

  // ~7,000 points per line: draw each pixel column's low and high, which
  // keeps every spike and stays fast however many periods there are.
  const paths = useMemo(() => {
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
  }, [result.relativeCosts, days, W, H, axis, scale]);

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

  /** The period nearest to a pointer position. */
  function indexAt(clientX: number, el: Element): number {
    const box = el.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * W;
    const day = d0 + ((px - plotL) / (plotR - plotL)) * (d1 - d0);
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

  const shown = hover ?? null;
  const tipLeft = shown !== null && x(days[shown]!) > W * 0.55;
  const label = (id: StrategyId) => STRATEGY_STYLE[id].label;

  return (
    <div>
      {/* Legend: also a way to highlight one strategy. */}
      <ul className="mb-3 flex flex-wrap gap-x-1 gap-y-0">
        {STRATEGY_IDS.map((id) => (
          <li key={id}>
            <button
              type="button"
              aria-pressed={active === id}
              onMouseEnter={() => onActive(id)}
              onMouseLeave={() => onActive(null)}
              onFocus={() => onActive(id)}
              onBlur={() => onActive(null)}
              onClick={() => onActive(active === id ? null : id)}
              className="t-small flex min-h-11 items-center gap-2 rounded-sm px-2 text-muted-foreground transition-colors hover:text-ink aria-pressed:text-ink"
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
          aria-label={`Cost of each strategy at today's rate, for every period starting ${formatDate(result.firstStart)} to ${formatDate(result.lastStart)}. The selected period starts ${formatDate(result.startDates[selected]!)}. Use the period slider below to pick another.`}
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
            onSelect(indexAt(e.clientX, e.currentTarget));
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
          {years.map((yr) => {
            const px = x(toEpochDay(`${yr}-01-01`));
            return (
              <text
                key={yr}
                x={px}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[12px] tabular-nums"
              >
                {yr}
              </text>
            );
          })}

          {STRATEGY_IDS.map((id) => (
            <path
              key={id}
              d={paths[id]}
              fill="none"
              stroke={STRATEGY_STYLE[id].color}
              strokeWidth={id === "lumpSum" ? 1.5 : 1.25}
              strokeLinejoin="round"
              style={{
                opacity: active && active !== id ? 0.15 : 0.9,
                transition: "opacity var(--fast) var(--ease)",
              }}
            />
          ))}

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
                x1={x(days[shown]!)}
                x2={x(days[shown]!)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--ink)"
                strokeWidth={1}
              />
              {STRATEGY_IDS.map((id) => (
                <circle
                  key={id}
                  cx={x(days[shown]!)}
                  cy={y(cost(id, shown))}
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
            className="t-small pointer-events-none absolute top-2 z-10 w-60 rounded-lg border bg-surface p-3 shadow-[var(--shadow-pop)]"
            style={
              tipLeft
                ? { right: W - x(days[shown]!) + 12 }
                : { left: x(days[shown]!) + 12 }
            }
          >
            <p className="font-medium">
              Starting {formatDate(result.startDates[shown]!)}
            </p>
            <dl className="mt-2 space-y-1">
              {STRATEGY_IDS.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3"
                >
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: STRATEGY_STYLE[id].color }}
                    />
                    {label(id)}
                  </dt>
                  <dd className="tabular-nums">{formatSgd(cost(id, shown))}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 border-t pt-1">
                <dt className="text-muted-foreground">Difference</dt>
                <dd className="tabular-nums">
                  {signedSgd(cost(compare.a, shown) - cost(compare.b, shown))}
                </dd>
              </div>
            </dl>
            <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
              {label(compare.a)} minus {label(compare.b).toLowerCase()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** "−S$85" / "+S$120": the sign says which way the difference goes. */
export function signedSgd(v: number): string {
  const s = formatSgd(Math.abs(v));
  if (s === "S$0" || s === "S$0.00") return s;
  return `${v < 0 ? "−" : "+"}${s}`;
}
