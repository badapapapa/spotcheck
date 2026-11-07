"use client";

import { useState } from "react";
import type { ReplayResult } from "@/engine/replay.ts";
import type { Summary } from "@/engine/stats.ts";
import { STRATEGY_IDS } from "@/engine/types.ts";
import {
  formatPercent,
  formatSgd,
  formatSgdAt,
  formatSgdCompactTicks,
} from "@/lib/format.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { niceTicks, sgdTickDecimals } from "@/lib/ticks.ts";
import { textWidth } from "@/lib/text-width.ts";
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
            : `cost less than all at once in ${formatPercent(result.stats[id].beatLumpSum)} of past periods`,
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
  // Whole dollars unless the scenario itself costs under S$100.
  const scale = Math.max(...rows.map((r) => r.summary.median));
  const sgd = (v: number) => formatSgdAt(v, scale);
  const name = (r: RangeRow) => (stacked ? (r.shortLabel ?? r.label) : r.label);
  const medianText = (r: RangeRow) => `median ${sgd(r.summary.median)}`;
  const widest = (texts: string[], px: number, weight?: number) =>
    Math.max(...texts.map((t) => textWidth(t, px, weight)));
  const nameW = widest(rows.map(name), 14, 500);
  const medianW = widest(rows.map(medianText), 14);
  // Narrow: a name and its median share a line while they fit; a huge
  // amount puts every median under its name instead, so no row looks
  // different from the others.
  const medianBelow = stacked && nameW + medianW + 16 > W;
  // Wide: names in a left column, medians in a right column wide enough
  // for the longest median, bars between.
  const left = stacked ? 0 : 168;
  const right = stacked ? 0 : Math.max(112, Math.ceil(medianW) + 8);
  const all = rows.map((r) => r.summary);
  const lo = Math.min(...all.map((s) => s.min));
  const hi = Math.max(...all.map((s) => s.max));
  // Tidy ticks whose labels never repeat; fewer on narrow screens so the
  // S$ labels never touch.
  const axis = niceTicks(lo, hi, W < 400 ? 2 : W < 640 ? 3 : 4);
  const ticks = axis.ticks;
  const domain = axis.domain;
  const tickDecimals = sgdTickDecimals(axis);
  const plotL = left + 8;
  const plotR = W - right - 8;
  const x = (v: number) =>
    plotL + ((v - domain[0]) / (domain[1] - domain[0])) * (plotR - plotL);
  // Where a tick label sits: anchored at its end near the chart's edges,
  // centred elsewhere (as drawn below).
  const anchor = (px: number) =>
    px < 40 ? "start" : px > W - 40 ? "end" : "middle";
  const span = (px: number, w: number): [number, number] => {
    const a = anchor(px);
    return a === "start"
      ? [px, px + w]
      : a === "end"
        ? [px - w, px]
        : [px - w / 2, px + w / 2];
  };
  // Full tick labels while none touches its neighbour (12px apart); compact
  // ones (S$1.5T) when they would, with the full value kept as the label's
  // accessible name.
  const fullTicks = ticks.map((t) => formatSgd(t, { decimals: tickDecimals }));
  const spans = ticks.map((t, k) => span(x(t), textWidth(fullTicks[k]!, 12)));
  const compact = spans.some((s, k) => k > 0 && spans[k - 1]![1] + 12 > s[0]);
  const tickLabels = compact
    ? formatSgdCompactTicks(ticks, axis.step)
    : fullTicks;
  const rowH = stacked ? ROW_H + 12 + (medianBelow ? 20 : 0) : ROW_H;
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
        {ticks.map((t, k) => (
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
              textAnchor={anchor(x(t))}
              className="fill-muted-foreground text-chart tabular-nums"
              aria-label={compact ? fullTicks[k] : undefined}
            >
              {tickLabels[k]}
            </text>
          </g>
        ))}
        {rows.map((row, i) => {
          const { id, summary: s } = row;
          const y0 = TOP + i * rowH;
          const yBar = stacked
            ? y0 + 42 + (medianBelow ? 20 : 0)
            : y0 + rowH / 2;
          const yText = stacked ? y0 + 18 : yBar + 5;
          const yMedian = medianBelow ? yText + 20 : yText;
          const point = s.max - s.min < (domain[1] - domain[0]) * 0.002;
          const dim = active !== null && active !== undefined && active !== id;
          return (
            <g
              key={id}
              // A button only where clicking pins the row (the planner); on
              // Hedging the rows just preview on hover, and the table below
              // holds the same figures for the keyboard.
              {...(onToggle
                ? {
                    tabIndex: 0,
                    role: "button",
                    "aria-label": `${row.label}: median ${sgd(s.median)}, 5th to 95th percentile ${sgd(s.p5)} to ${sgd(s.p95)}`,
                    onFocus: () => setActive(id),
                    onBlur: () => setActive(null),
                    onClick: () => onToggle(id),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle(id);
                      }
                    },
                  }
                : { "aria-hidden": true })}
              onMouseEnter={() => setActive(id)}
              onMouseLeave={() => setActive(null)}
              className={`${onToggle ? "cursor-pointer" : "cursor-default"} outline-none [&:focus-visible>rect:first-child]:stroke-[var(--accent)]`}
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
              {/* Dimmed rows keep their text at --muted (≥ 4.5:1); only the
                  marks fade (DESIGN.md §6). */}
              <text
                aria-hidden
                x={0}
                y={yText}
                className={`${dim ? "fill-[var(--muted)]" : "fill-[var(--ink)]"} text-sm font-medium`}
              >
                {name(row)}
              </text>
              <text
                aria-hidden
                x={medianBelow ? 0 : W}
                y={yMedian}
                textAnchor={medianBelow ? "start" : "end"}
                className={`${dim ? "fill-[var(--muted)]" : "fill-[var(--ink)]"} text-sm tabular-nums`}
              >
                {medianText(row)}
              </text>
              <g
                opacity={dim ? 0.3 : 1}
                style={{ transition: "opacity var(--fast) var(--ease)" }}
              >
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
            Bar: the middle 90% of past periods. Ring: the median. Line:
            cheapest to most expensive. Further left is cheaper.
          </>
        )}
      </figcaption>
    </figure>
  );
}
