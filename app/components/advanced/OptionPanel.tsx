"use client";

import { useId, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  gkCall,
  gkCallGreeks,
  type GkInputs,
  type Greeks,
} from "@/engine/options.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatPercent, formatRate, formatSgd } from "@/lib/format.ts";
import { HEDGE_STYLE } from "@/lib/hedge-style.ts";
import { useCoarsePointer } from "@/lib/use-coarse-pointer.ts";
import { niceTicks, sgdTickDecimals, type Ticks } from "@/lib/ticks.ts";
import { LIMITS, VOL_LOOKBACKS, type VolLookback } from "@/lib/url-state.ts";
import { HelpTip } from "../HelpTip";
import { ValueRows } from "../ValueRows";

type Props = {
  currency: string;
  amount: number;
  spread: number;
  deadline: string;
  base: Omit<GkInputs, "K" | "sigma">; // spot, continuous rates, T
  forward: number;
  strikePct: number;
  realised: { sigma: number; lookback: VolLookback; from: string; to: string };
  volOverride?: number;
  onStrike: (pct: number) => void;
  onVol: (override: number | undefined, lookback: VolLookback) => void;
};

const axisTick = { fill: "var(--muted)", fontSize: 12 };
const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 13,
};

/** Plain-English notes for the "What is this?" tips. */
const HELP = {
  premium:
    "What the option costs up front, per unit of foreign currency. You pay it whether or not you end up using the option.",
  delta:
    "How much the option's value moves when the spot rate moves by 1 SGD, per unit. Near 0.5 means about half as sensitive as the currency itself.",
  gamma:
    "How quickly delta itself changes as the spot rate moves. It is largest when the rate is near the strike.",
  vega: "How much the option's value changes if volatility rises by one percentage point.",
  theta:
    "How much the option's value changes each day as the deadline gets closer, with everything else unchanged. It can be positive: when the foreign currency's interest rate is above the SGD rate, the forward sits below spot and moves up toward it as the deadline nears, which adds value to the call.",
};

/** Panel 2: price a call on the foreign currency, its payoff and its Greeks. */
export function OptionPanel(props: Props) {
  const {
    currency,
    amount,
    spread,
    base,
    forward,
    strikePct,
    realised,
    volOverride,
  } = props;
  const id = useId();
  const sigma = volOverride ?? realised.sigma;
  const K = base.S * strikePct;
  const inputs: GkInputs = { ...base, K, sigma: Math.max(sigma, 1e-4) };
  const premium = gkCall(inputs);
  const greeks = gkCallGreeks(inputs);

  // Spot grid from 85% to 115% of today's spot.
  const grid = useMemo(
    () =>
      Array.from({ length: 61 }, (_, i) => base.S * (0.85 + (0.3 * i) / 60)),
    [base.S],
  );
  const payoff = grid.map((ST) => ({
    ST,
    unhedged: amount * ST * (1 + spread),
    forward: amount * forward * (1 + spread),
    option: amount * (premium + Math.min(ST, K) * (1 + spread)),
  }));
  const greekCurves = grid.map((S) => ({
    S,
    ...gkCallGreeks({ ...inputs, S }),
  }));
  const payoffAxis = axisFor(
    payoff.flatMap((p) => [p.unhedged, p.forward, p.option]),
    4,
  );
  // Round rate ticks (1.10, 1.20, …), kept inside the plotted range.
  const rateAxis = insideTicks(grid[0]!, grid.at(-1)!, 4);
  const greekRateAxis = insideTicks(grid[0]!, grid.at(-1)!, 3);
  const coarse = useCoarsePointer();
  const [payoffAt, setPayoffAt] = useState<number | undefined>();
  const [greekAt, setGreekAt] = useState<
    Partial<Record<keyof Greeks, number | undefined>>
  >({});

  return (
    <>
      <section
        aria-labelledby="option-title"
        className="space-y-6 lg:border-l lg:pl-12"
      >
        <div>
          <h2 id="option-title" className="t-h2">
            What an option would cost
          </h2>
          <p className="mt-3 text-muted-foreground">
            A call option gives the right, not the obligation, to buy {currency}{" "}
            at the strike on your deadline. You pay a premium today; if the rate
            ends up above the strike you convert at the strike, otherwise at the
            market rate.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <label htmlFor={`${id}-strike`} className="t-small font-medium">
              Strike: {formatRate(K)} ({Math.round(strikePct * 100)}% of spot)
            </label>
            <input
              id={`${id}-strike`}
              type="range"
              min={LIMITS.strikePct.min}
              max={LIMITS.strikePct.max}
              step={1}
              value={Math.round(strikePct * 100)}
              onChange={(e) => props.onStrike(Number(e.target.value) / 100)}
              aria-valuetext={`${e2s(strikePct)} of spot, ${formatRate(K)}`}
              className="h-11 w-full accent-primary"
            />
          </div>
          <div className="grid content-start gap-1.5">
            <label htmlFor={`${id}-vol`} className="t-small font-medium">
              Volatility (% a year)
            </label>
            <div className="flex gap-2">
              <input
                id={`${id}-vol`}
                type="number"
                inputMode="decimal"
                min={LIMITS.volPct.min}
                max={LIMITS.volPct.max}
                step={0.5}
                placeholder={(realised.sigma * 100).toFixed(1)}
                value={
                  volOverride === undefined
                    ? ""
                    : String(Number((volOverride * 100).toFixed(2)))
                }
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (e.target.value === "")
                    props.onVol(undefined, realised.lookback);
                  else if (v >= LIMITS.volPct.min && v <= LIMITS.volPct.max)
                    props.onVol(v / 100, realised.lookback);
                }}
                className="field-input min-w-0 flex-1"
              />
              <select
                aria-label="Realised volatility lookback"
                value={realised.lookback}
                onChange={(e) =>
                  props.onVol(
                    volOverride,
                    VOL_LOOKBACKS.find((n) => String(n) === e.target.value) ??
                      250,
                  )
                }
                className="field-input w-auto"
              >
                {VOL_LOOKBACKS.map((n) => (
                  <option key={n} value={n}>
                    {n}-day
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-muted-foreground">
              {volOverride === undefined
                ? `Realised volatility (proxy for implied): ${(realised.sigma * 100).toFixed(1)}%, from ${realised.lookback} trading days ${formatDate(realised.from)}–${formatDate(realised.to)}. Type a number to override.`
                : `Your override. Leave it empty to use realised volatility (${(realised.sigma * 100).toFixed(1)}%).`}
            </p>
          </div>
        </div>

        <ValueRows
          rows={[
            {
              key: "unit",
              label: (
                <>
                  Premium per unit
                  <HelpTip term="the premium">{HELP.premium}</HelpTip>
                </>
              ),
              value: `${formatRate(premium)} SGD`,
            },
            {
              label: `Premium for ${amount.toLocaleString("en-SG")} ${currency}`,
              value: formatSgd(premium * amount),
            },
            {
              label: "Premium, % of notional",
              value: formatPercent(premium / base.S, 2),
            },
            {
              label: "Worst-case cost",
              value: formatSgd(amount * (premium + K * (1 + spread))),
            },
          ]}
        />

        <figure className="space-y-2">
          <figcaption className="t-h3">
            Total SGD cost on {formatDate(props.deadline)}, by where the rate
            ends up
          </figcaption>
          <div
            className="h-72 w-full sm:h-64"
            role="img"
            aria-label={`Total SGD cost against the ${currency} rate on the deadline: unhedged rises with the rate, the forward is flat at ${formatSgd(amount * forward * (1 + spread))}, and the option is capped at ${formatSgd(amount * (premium + K * (1 + spread)))}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={payoff}
                // Room above the plot for the "today" label on the dashed line.
                margin={{ top: 24, right: 8, bottom: 0, left: 8 }}
                onClick={(st) => coarse && setPayoffAt(indexOf(st))}
                onMouseMove={(st) => coarse && setPayoffAt(indexOf(st))}
              >
                <CartesianGrid stroke="var(--rule)" vertical={false} />
                <XAxis
                  dataKey="ST"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) =>
                    v.toFixed(Math.max(2, rateAxis.decimals))
                  }
                  tick={axisTick}
                  stroke="var(--rule)"
                  ticks={rateAxis.ticks}
                />
                <YAxis
                  domain={payoffAxis.domain}
                  ticks={payoffAxis.ticks}
                  tickFormatter={(v: number) =>
                    formatSgd(v, { decimals: sgdTickDecimals(payoffAxis) })
                  }
                  tick={axisTick}
                  stroke="var(--rule)"
                  width={76}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  separator=": "
                  // Touch: no floating box (it stays open and covers the
                  // chart); the readout under the chart shows the values.
                  content={coarse ? () => null : undefined}
                  labelFormatter={(v) =>
                    `Rate on deadline ${formatRate(Number(v))}`
                  }
                  formatter={(v, name) => [formatSgd(Number(v)), name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
                  // Names in ink; the marker beside each carries the colour.
                  formatter={(name) => (
                    <span style={{ color: "var(--muted)" }}>{name}</span>
                  )}
                />
                <ReferenceLine
                  x={base.S}
                  stroke="var(--muted)"
                  strokeDasharray="4 4"
                  label={{
                    value: "today",
                    fill: "var(--muted)",
                    fontSize: 12,
                    position: "top",
                  }}
                />
                {(["unhedged", "forward", "option"] as const).map((h) => (
                  <Line
                    key={h}
                    dataKey={h}
                    name={HEDGE_STYLE[h].label}
                    stroke={HEDGE_STYLE[h].color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {coarse && (
            <p
              className="t-small min-h-10 tabular-nums"
              aria-live="polite"
              data-testid="payoff-readout"
            >
              {payoffAt === undefined ? (
                <span className="text-muted-foreground">
                  Tap the chart to read the values.
                </span>
              ) : (
                <>
                  <span className="font-medium">
                    Rate on deadline {formatRate(payoff[payoffAt]!.ST)}:
                  </span>{" "}
                  {(["unhedged", "forward", "option"] as const)
                    .map(
                      (h) =>
                        `${HEDGE_STYLE[h].short} ${formatSgd(payoff[payoffAt]![h])}`,
                    )
                    .join(", ")}
                </>
              )}
            </p>
          )}
        </figure>

        <p className="text-xs text-muted-foreground">
          Priced with Garman-Kohlhagen, using continuously compounded
          equivalents of the rates in the forward panel. The premium&apos;s own
          time value (interest you could have earned on it) is ignored. Real
          option quotes use implied volatility and a dealer margin, so they
          differ.
        </p>
      </section>

      <section
        aria-labelledby="greeks-title"
        className="space-y-6 border-t pt-10 lg:col-span-2"
      >
        <div>
          <h2 id="greeks-title" className="t-h2">
            How the option responds
          </h2>
          <p className="mt-3 text-muted-foreground">
            The Greeks: how the option&apos;s value changes as the rate,
            volatility and time move.
          </p>
        </div>
        <div className="grid gap-x-8 xl:grid-cols-2">
          <ValueRows
            rows={[
              {
                key: "delta",
                label: (
                  <>
                    Delta, per unit
                    <HelpTip term="delta">{HELP.delta}</HelpTip>
                  </>
                ),
                value: greeks.delta.toFixed(3),
              },
              {
                key: "gamma",
                label: (
                  <>
                    Gamma, per unit
                    <HelpTip term="gamma">{HELP.gamma}</HelpTip>
                  </>
                ),
                value: greeks.gamma.toFixed(2),
              },
            ]}
          />
          <ValueRows
            rows={[
              {
                key: "vega",
                label: (
                  <>
                    Vega, per volatility point
                    <HelpTip term="vega">{HELP.vega}</HelpTip>
                  </>
                ),
                value: formatSgd((greeks.vega / 100) * amount),
              },
              {
                key: "theta",
                label: (
                  <>
                    Theta, per day
                    <HelpTip term="theta">{HELP.theta}</HelpTip>
                  </>
                ),
                value: formatSgd((greeks.theta / 365) * amount),
              },
            ]}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Vega and theta are for your {amount.toLocaleString("en-SG")}{" "}
          {currency}, in SGD.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {greekCharts(amount)
            .map((g) => ({
              ...g,
              axis: axisFor(
                greekCurves.map((d) => g.scale(d[g.key])),
                3,
              ),
            }))
            .map((g) => (
              <figure key={g.key} className="space-y-1">
                <figcaption className="text-sm text-muted-foreground">
                  {g.title} vs spot
                </figcaption>
                <div
                  className="h-40 w-full"
                  role="img"
                  aria-label={`${g.title} against spot; at today's spot it is ${g.format(g.scale(greeks[g.key]))}.`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={greekCurves}
                      margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                      onClick={(st) =>
                        coarse &&
                        setGreekAt((a) => ({ ...a, [g.key]: indexOf(st) }))
                      }
                      onMouseMove={(st) =>
                        coarse &&
                        setGreekAt((a) => ({ ...a, [g.key]: indexOf(st) }))
                      }
                    >
                      <CartesianGrid stroke="var(--rule)" vertical={false} />
                      <XAxis
                        dataKey="S"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v: number) =>
                          v.toFixed(Math.max(2, greekRateAxis.decimals))
                        }
                        tick={axisTick}
                        stroke="var(--rule)"
                        ticks={greekRateAxis.ticks}
                      />
                      <YAxis
                        domain={g.axis.domain}
                        ticks={g.axis.ticks}
                        tickFormatter={(v: number) =>
                          g.sgd
                            ? formatSgd(v, {
                                decimals: sgdTickDecimals(g.axis),
                              })
                            : v.toFixed(g.axis.decimals)
                        }
                        tick={axisTick}
                        stroke="var(--rule)"
                        width={64}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        separator=": "
                        content={coarse ? () => null : undefined}
                        labelFormatter={(v) => `Spot ${formatRate(Number(v))}`}
                        formatter={(v) => [g.format(Number(v)), g.title]}
                      />
                      <ReferenceLine
                        x={base.S}
                        stroke="var(--muted)"
                        strokeDasharray="4 4"
                      />
                      <Line
                        dataKey={(d: Greeks) => g.scale(d[g.key])}
                        name={g.title}
                        stroke={HEDGE_STYLE.option.color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {coarse && (
                  <p
                    className="t-small min-h-5 text-muted-foreground tabular-nums"
                    aria-live="polite"
                  >
                    {greekAt[g.key] === undefined
                      ? "Tap to read a value."
                      : `Spot ${formatRate(greekCurves[greekAt[g.key]!]!.S)}: ${g.format(g.scale(greekCurves[greekAt[g.key]!]![g.key]))}`}
                  </p>
                )}
              </figure>
            ))}
        </div>
      </section>
    </>
  );
}

const e2s = (pct: number) => `${Math.round(pct * 100)}%`;

/** Delta and gamma per unit; vega and theta for the user's whole amount, in SGD. */
function greekCharts(amount: number): {
  key: keyof Greeks;
  title: string;
  scale: (v: number) => number;
  format: (v: number) => string;
  /** Axis shows SGD (cents where the spacing needs them). */
  sgd?: boolean;
}[] {
  return [
    {
      key: "delta",
      title: "Delta",
      scale: (v) => v,
      format: (v) => v.toFixed(2),
    },
    {
      key: "gamma",
      title: "Gamma",
      scale: (v) => v,
      format: (v) => v.toFixed(1),
    },
    {
      key: "vega",
      title: "Vega (S$ per vol point)",
      scale: (v) => (v / 100) * amount,
      format: (v) => formatSgd(v),
      sgd: true,
    },
    {
      key: "theta",
      title: "Theta (S$ per day)",
      scale: (v) => (v / 365) * amount,
      format: (v) => formatSgd(v),
      sgd: true,
    },
  ];
}

/** The chart's active point from a Recharts event, if any. */
function indexOf(
  st: { activeTooltipIndex?: number | string | null } | null | undefined,
) {
  const i = st?.activeTooltipIndex;
  return i === null || i === undefined ? undefined : Number(i);
}

/** Tidy ticks for a range, dropping any that fall outside it. */
function insideTicks(lo: number, hi: number, target: number): Ticks {
  const t = niceTicks(lo, hi, target);
  return { ...t, ticks: t.ticks.filter((v) => v >= lo && v <= hi) };
}

/** Tidy, never-repeating ticks for a set of plotted values. */
function axisFor(values: number[], target: number): Ticks {
  return niceTicks(Math.min(...values), Math.max(...values), target);
}
