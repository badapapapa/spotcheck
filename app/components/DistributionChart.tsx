"use client";

import { useState } from "react";
import type { ReplayResult } from "@/engine/replay.ts";
import { STRATEGY_IDS, type StrategyId } from "@/engine/types.ts";
import { formatPercent, formatSgd } from "@/lib/format.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { useWidth } from "@/lib/use-width.ts";

const PAD_X = 16;
const ROW_H = 64;
const TOP = 8;
const AXIS_H = 28;

/** Rounds a step to 1, 2 or 5 × a power of ten for tidy axis ticks. */
function niceStep(span: number, target: number): number {
  const raw = span / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f >= 5 ? 10 : f >= 2 ? 5 : f >= 1 ? 2 : 1) * pow;
}

/**
 * One row per strategy: a thin line from the cheapest to the most expensive
 * window, a bar for the middle 90% (5th–95th percentile), and a dot for the
 * median. Lower is cheaper.
 */
export function DistributionChart({ result }: { result: ReplayResult }) {
  const [active, setActive] = useState<StrategyId | null>(null);
  const [ref, measured] = useWidth<HTMLElement>();
  const W = Math.max(280, measured);
  const all = STRATEGY_IDS.map((id) => result.stats[id].summary);
  const lo = Math.min(...all.map((s) => s.min));
  const hi = Math.max(...all.map((s) => s.max));
  const pad = (hi - lo) * 0.04 || hi * 0.01;
  const domain = [lo - pad, hi + pad] as const;
  const x = (v: number) =>
    PAD_X + ((v - domain[0]) / (domain[1] - domain[0])) * (W - 2 * PAD_X);
  const step = niceStep(domain[1] - domain[0], W < 480 ? 3 : 4);
  const ticks: number[] = [];
  for (let t = Math.ceil(domain[0] / step) * step; t <= domain[1]; t += step)
    ticks.push(t);
  const H = TOP + STRATEGY_IDS.length * ROW_H + AXIS_H;
  const shown = active ? result.stats[active] : null;

  return (
    <figure ref={ref} className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block max-w-full"
        role="img"
        aria-label="Range of SGD cost for each strategy across all historical windows. Details are in the table below."
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={TOP}
              y2={H - AXIS_H}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
            <text
              x={x(t)}
              y={H - 8}
              textAnchor={
                x(t) < 40 ? "start" : x(t) > W - 40 ? "end" : "middle"
              }
              className="fill-muted-foreground text-[13px] tabular-nums"
            >
              {formatSgd(t)}
            </text>
          </g>
        ))}
        {STRATEGY_IDS.map((id, i) => {
          const s = result.stats[id].summary;
          const style = STRATEGY_STYLE[id];
          const y0 = TOP + i * ROW_H;
          const yBar = y0 + 40;
          const point = s.max - s.min < (domain[1] - domain[0]) * 0.002;
          return (
            <g
              key={id}
              tabIndex={0}
              role="button"
              aria-label={`${style.label}: median ${formatSgd(s.median)}, 5th to 95th percentile ${formatSgd(s.p5)} to ${formatSgd(s.p95)}`}
              onMouseEnter={() => setActive(id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(id)}
              onBlur={() => setActive(null)}
              className="cursor-default outline-none [&:focus-visible>rect:first-child]:stroke-ring"
            >
              {/* Hit target larger than the marks */}
              <rect
                x={0}
                y={y0}
                width={W}
                height={ROW_H}
                fill="transparent"
                stroke="transparent"
                strokeWidth={2}
                rx={6}
              />
              {active === id && (
                <rect
                  x={0}
                  y={y0}
                  width={W}
                  height={ROW_H}
                  className="fill-muted"
                  rx={6}
                />
              )}
              <text
                x={PAD_X}
                y={y0 + 20}
                className="fill-foreground text-[15px] font-medium"
              >
                {style.label}
              </text>
              <text
                x={W - PAD_X}
                y={y0 + 20}
                textAnchor="end"
                className="fill-muted-foreground text-[14px] tabular-nums"
              >
                median {formatSgd(s.median)}
              </text>
              {!point && (
                <>
                  <line
                    x1={x(s.min)}
                    x2={x(s.max)}
                    y1={yBar}
                    y2={yBar}
                    stroke="var(--muted-foreground)"
                    strokeOpacity={0.5}
                    strokeWidth={2}
                  />
                  <rect
                    x={x(s.p5)}
                    y={yBar - 6}
                    width={Math.max(2, x(s.p95) - x(s.p5))}
                    height={12}
                    rx={4}
                    fill={style.color}
                    fillOpacity={0.85}
                  />
                </>
              )}
              <circle
                cx={x(s.median)}
                cy={yBar}
                r={7}
                fill={style.color}
                stroke="var(--background)"
                strokeWidth={2.5}
              />
            </g>
          );
        })}
      </svg>
      <figcaption
        className="min-h-10 text-sm text-muted-foreground"
        aria-live="polite"
      >
        {shown && active ? (
          <>
            <span className="font-medium text-foreground">
              {STRATEGY_STYLE[active].label}:
            </span>{" "}
            cheapest {formatSgd(shown.summary.min)}, middle 90%{" "}
            {formatSgd(shown.summary.p5)}–{formatSgd(shown.summary.p95)}, most
            expensive {formatSgd(shown.summary.max)}
            {active !== "lumpSum" && (
              <>
                ; cost less than all at once in{" "}
                {formatPercent(shown.beatLumpSum)} of windows
              </>
            )}
            .
          </>
        ) : (
          <>
            Bar: middle 90% of windows. Dot: median. Thin line: cheapest to most
            expensive. Lower is cheaper.
          </>
        )}
      </figcaption>
    </figure>
  );
}
