"use client";

import { useState } from "react";
import type { ReplayResult } from "@/engine/replay.ts";
import type { Summary } from "@/engine/stats.ts";
import { STRATEGY_IDS } from "@/engine/types.ts";
import { formatPercent, formatSgd, formatSgdAt } from "@/lib/format.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { niceTicks, sgdTickDecimals } from "@/lib/ticks.ts";
import { useWidth } from "@/lib/use-width.ts";

const ROW_H = 52;
const TOP = 4;
const AXIS_H = 28;
/** Below this width, names sit above their bars instead of beside them. */
const STACK_BELOW = 560;

export type RangeRow = {
  id: string;
  label: string;
  /** Drawn instead of `label` when the chart is narrow, so it can't run into the median. */
  shortLabel?: string;
  color: string;
  summary: Summary;
  /** Extra text for the readout, e.g. how often it beat another row. */
  note?: string;
};

/** The planner's chart: one row per strategy. */
export function DistributionChart({
  result,
  active,
  onActive,
  onToggle,
}: {
  result: ReplayResult;
  active?: string | null;
  onActive?: (id: string | null) => void;
  onToggle?: (id: string) => void;
}) {
  return (
    <RangeChart
      label="Range of SGD cost for each strategy across all comparable past periods. The same numbers are in the table below."
      active={active}
      onActive={onActive}
      onToggle={onToggle}
      rows={STRATEGY_IDS.map((id) => ({
        id,
        label: STRATEGY_STYLE[id].label,
        color: STRATEGY_STYLE[id].color,
        summary: result.stats[id].summary,
        note:
          id === "lumpSum"
            ? undefined
            : `cost less than all at once in ${formatPercent(result.stats[id].beatLumpSum)} of periods`,
      }))}
    />
  );
}

/**
 * One row per option (DESIGN.md §6): a hairline from the cheapest to the
 * most expensive period, a bar for the middle 90% (5th–95th percentile) and
 * a dot for the median. Lower is cheaper. Hovering or focusing a row dims
 * the others; the readout underneath spells the row out in words.
 */
export function RangeChart({
  rows,
  label,
  active: activeProp,
  onActive,
  onToggle,
}: {
  rows: RangeRow[];
  label: string;
  /** Lets a parent (e.g. the table) share the highlighted row. */
  active?: string | null;
  onActive?: (id: string | null) => void;
  /** Click or Enter/Space on a row: pin (or unpin) its highlight. */
  onToggle?: (id: string) => void;
}) {
  const [localActive, setLocalActive] = useState<string | null>(null);
  const active = activeProp ?? localActive;
  const setActive = (id: string | null) => {
    setLocalActive(id);
    onActive?.(id);
  };
  const [ref, measured] = useWidth<HTMLElement>();
  const W = Math.max(280, measured);
  const stacked = W < STACK_BELOW;
  // Wide: names in a left column, medians in a right column, bars between.
  const left = stacked ? 0 : 168;
  const right = stacked ? 0 : 112;
  const all = rows.map((r) => r.summary);
  const lo = Math.min(...all.map((s) => s.min));
  const hi = Math.max(...all.map((s) => s.max));
  // Tidy ticks whose labels never repeat; fewer on narrow screens so the
  // S$ labels never touch.
  const axis = niceTicks(lo, hi, W < 400 ? 2 : W < 640 ? 3 : 4);
  const ticks = axis.ticks;
  const domain = axis.domain;
  const tickDecimals = sgdTickDecimals(axis);
  // Whole dollars unless the scenario itself costs under S$100.
  const scale = Math.max(...rows.map((r) => r.summary.median));
  const sgd = (v: number) => formatSgdAt(v, scale);
  const plotL = left + 8;
  const plotR = W - right - 8;
  const x = (v: number) =>
    plotL + ((v - domain[0]) / (domain[1] - domain[0])) * (plotR - plotL);
  const rowH = stacked ? ROW_H + 12 : ROW_H;
  const H = TOP + rows.length * rowH + AXIS_H;
  const shown = rows.find((r) => r.id === active);

  return (
    <figure ref={ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block max-w-full"
        // A group, not an image: its rows are focusable buttons, which an
        // image role would hide from screen readers.
        role="group"
        aria-label={label}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={TOP}
              y2={H - AXIS_H + 4}
              stroke="var(--rule)"
              strokeWidth={1}
            />
            <text
              x={x(t)}
              y={H - 8}
              textAnchor={
                x(t) < 40 ? "start" : x(t) > W - 40 ? "end" : "middle"
              }
              className="fill-muted-foreground text-[12px] tabular-nums"
            >
              {formatSgd(t, { decimals: tickDecimals })}
            </text>
          </g>
        ))}
        {rows.map((row, i) => {
          const { id, summary: s } = row;
          const y0 = TOP + i * rowH;
          const yBar = stacked ? y0 + 42 : y0 + rowH / 2;
          const yText = stacked ? y0 + 18 : yBar + 5;
          const point = s.max - s.min < (domain[1] - domain[0]) * 0.002;
          const dim = active !== null && active !== undefined && active !== id;
          return (
            <g
              key={id}
              tabIndex={0}
              role="button"
              aria-label={`${row.label}: median ${sgd(s.median)}, 5th to 95th percentile ${sgd(s.p5)} to ${sgd(s.p95)}`}
              onMouseEnter={() => setActive(id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(id)}
              onBlur={() => setActive(null)}
              onClick={() => onToggle?.(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle?.(id);
                }
              }}
              className={`${onToggle ? "cursor-pointer" : "cursor-default"} outline-none [&:focus-visible>rect:first-child]:stroke-[var(--accent)]`}
              style={{
                opacity: dim ? 0.3 : 1,
                transition: "opacity var(--fast) var(--ease)",
              }}
            >
              {/* Hit target larger than the marks; the focus ring draws on it. */}
              <rect
                x={1}
                y={y0 + 1}
                width={W - 2}
                height={rowH - 2}
                fill="transparent"
                stroke="transparent"
                strokeWidth={2}
                rx={4}
              />
              {i > 0 && (
                <line
                  x1={0}
                  x2={W}
                  y1={y0}
                  y2={y0}
                  stroke="var(--rule)"
                  strokeWidth={1}
                />
              )}
              <text
                aria-hidden
                x={0}
                y={yText}
                className="fill-[var(--ink)] text-[14px] font-medium"
              >
                {stacked ? (row.shortLabel ?? row.label) : row.label}
              </text>
              <text
                aria-hidden
                x={W}
                y={yText}
                textAnchor="end"
                className="fill-[var(--ink)] text-[14px] tabular-nums"
              >
                median {sgd(s.median)}
              </text>
              {!point && (
                <>
                  <line
                    x1={x(s.min)}
                    x2={x(s.max)}
                    y1={yBar}
                    y2={yBar}
                    stroke="var(--muted)"
                    strokeWidth={1.5}
                  />
                  <rect
                    x={x(s.p5)}
                    y={yBar - 5}
                    width={Math.max(2, x(s.p95) - x(s.p5))}
                    height={10}
                    rx={2}
                    fill={row.color}
                  />
                </>
              )}
              <circle
                cx={x(s.median)}
                cy={yBar}
                r={point ? 5.5 : 4.5}
                fill={point ? row.color : "var(--surface)"}
                stroke={point ? "var(--surface)" : "var(--ink)"}
                strokeWidth={2}
              />
            </g>
          );
        })}
      </svg>
      <figcaption
        className="t-small mt-3 min-h-10 text-muted-foreground"
        aria-live="polite"
      >
        {shown ? (
          <>
            <span className="font-medium text-ink">{shown.label}:</span>{" "}
            cheapest {sgd(shown.summary.min)}, middle 90%{" "}
            {sgd(shown.summary.p5)}–{sgd(shown.summary.p95)}, most expensive{" "}
            {sgd(shown.summary.max)}
            {shown.note && <>; {shown.note}</>}.
          </>
        ) : (
          <>
            Bar: the middle 90% of periods. Ring: the median. Line: cheapest to
            most expensive. Further left is cheaper.
          </>
        )}
      </figcaption>
    </figure>
  );
}
