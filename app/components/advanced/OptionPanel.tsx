"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
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
import {
  formatPercent,
  formatPremiumPerUnit,
  formatRate,
  formatSgd,
} from "@/lib/format.ts";
import { readNumberField } from "@/lib/number-input.ts";
import {
  AXIS_STROKE,
  AXIS_TICK,
  LINE_WIDTH,
  REFERENCE_LABEL,
  REFERENCE_LINE,
  TOOLTIP_STYLE,
} from "@/lib/chart-style.ts";
import { HEDGE_IDS, HEDGE_STYLE } from "@/lib/hedge-style.ts";
import { useCoarsePointer } from "@/lib/use-coarse-pointer.ts";
import { niceTicks, sgdTickDecimals, type Ticks } from "@/lib/ticks.ts";
import { LIMITS, VOL_LOOKBACKS, type VolLookback } from "@/lib/url-state.ts";
import { HelpTip } from "../HelpTip";
import { ChartLegend } from "../ChartLegend";
import { ValueRows } from "../ValueRows";

type Props = {
  /** Label of the dashed spot line: "today", "2 Jan 2025" or "latest". */
  spotLabel: string;
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

/** Plain-English notes for the "About …" help tips. */
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
  // The volatility field keeps its own text: a value is used once the whole
  // entry is 1–100, and anything else says so instead of vanishing.
  const volText = (v?: number) =>
    v === undefined ? "" : String(Number((v * 100).toFixed(2)));
  const [vol, setVol] = useState(() => ({
    text: volText(volOverride),
    error: undefined as string | undefined,
    for: volOverride,
  }));
  // An override set from outside (a link, back/forward) replaces the text,
  // unless the text already says the same value.
  const [seenOverride, setSeenOverride] = useState(volOverride);
  if (seenOverride !== volOverride) {
    setSeenOverride(volOverride);
    if (vol.for !== volOverride)
      setVol({
        text: volText(volOverride),
        error: undefined,
        for: volOverride,
      });
  }
  // Like the scenario fields: a valid value is used once typing pauses, so
  // "101" never passes through 10 on its way to an error.
  const volTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (volTimer.current) clearTimeout(volTimer.current);
    },
    [],
  );
  function typeVol(text: string) {
    if (volTimer.current) clearTimeout(volTimer.current);
    if (text.trim() === "") {
      setVol({ text, error: undefined, for: undefined });
      volTimer.current = setTimeout(
        () => props.onVol(undefined, realised.lookback),
        400,
      );
      return;
    }
    const r = readNumberField(text, {
      ...LIMITS.volPct,
      range: `Enter ${LIMITS.volPct.min}–${LIMITS.volPct.max}%, or leave it empty for realised volatility.`,
    });
    if (!r.ok) {
      setVol((v) => ({ ...v, text, error: r.message }));
      return;
    }
    setVol({ text, error: undefined, for: r.value / 100 });
    volTimer.current = setTimeout(
      () => props.onVol(r.value / 100, realised.lookback),
      400,
    );
  }
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
            at the strike on your deadline. You pay a premium up front; if the
            rate ends up above the strike you convert at the strike, otherwise
            at the market rate.
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
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={(realised.sigma * 100).toFixed(1)}
                value={vol.text}
                aria-invalid={vol.error ? true : undefined}
                aria-describedby={`${id}-vol-note`}
                onChange={(e) => typeVol(e.target.value)}
                className="field-input min-w-0 flex-1"
              />
              <span className="relative flex">
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
                  className="field-input field-select w-auto"
                >
                  {VOL_LOOKBACKS.map((n) => (
                    <option key={n} value={n}>
                      {n}-day
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2.5}
                />
              </span>
            </div>
            <p
              id={`${id}-vol-note`}
              className={`text-sm ${vol.error ? "text-destructive" : "text-muted-foreground"}`}
              data-testid="vol-note"
            >
              {vol.error ??
                (volOverride === undefined
                  ? `Realised volatility (proxy for implied): ${(realised.sigma * 100).toFixed(1)}%, from ${realised.lookback} daily changes, ${formatDate(realised.from)}–${formatDate(realised.to)}. Type 1–100 to override.`
                  : `Your override (1–100%). Leave it empty to use realised volatility (${(realised.sigma * 100).toFixed(1)}%).`)}
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
              value: `${formatPremiumPerUnit(premium)} SGD`,
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
                // No focus stop or assertive live region: the readouts and
                // the figures beside the chart carry the values (B1).
                accessibilityLayer={false}
                data={payoff}
                // Room above the plot for the "today" label on the dashed line.
                margin={{ top: 24, right: 8, bottom: 0, left: 8 }}
                onClick={(st) => coarse && setPayoffAt(indexOf(st))}
                onMouseMove={(st) => coarse && setPayoffAt(indexOf(st))}
              >
                <CartesianGrid stroke={AXIS_STROKE} vertical={false} />
                <XAxis
                  dataKey="ST"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) =>
                    v.toFixed(Math.max(2, rateAxis.decimals))
                  }
                  tick={AXIS_TICK}
                  stroke={AXIS_STROKE}
                  ticks={rateAxis.ticks}
                />
                <YAxis
                  domain={payoffAxis.domain}
                  ticks={payoffAxis.ticks}
                  tickFormatter={(v: number) =>
                    formatSgd(v, { decimals: sgdTickDecimals(payoffAxis) })
                  }
                  tick={AXIS_TICK}
                  stroke={AXIS_STROKE}
                  width={76}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
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
                  // Our own legend, in the hedge order of the history table.
                  content={() => (
                    <ChartLegend
                      className="pt-2"
                      items={HEDGE_IDS.map((h) => ({
                        key: h,
                        label: HEDGE_STYLE[h].label,
                        color: HEDGE_STYLE[h].color,
                        mark: "line",
                      }))}
                    />
                  )}
                />
                <ReferenceLine
                  x={base.S}
                  {...REFERENCE_LINE}
                  label={{
                    ...REFERENCE_LABEL,
                    value: props.spotLabel,
                    position: "top",
                  }}
                />
                {HEDGE_IDS.map((h) => (
                  <Line
                    key={h}
                    dataKey={h}
                    name={HEDGE_STYLE[h].label}
                    stroke={HEDGE_STYLE[h].color}
                    strokeWidth={LINE_WIDTH}
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
                  {HEDGE_IDS.map(
                    (h) =>
                      `${HEDGE_STYLE[h].short} ${formatSgd(payoff[payoffAt]![h])}`,
                  ).join(", ")}
                </>
              )}
            </p>
          )}
        </figure>

        <p className="text-annotation text-muted-foreground">
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
                      accessibilityLayer={false}
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
                      <CartesianGrid stroke={AXIS_STROKE} vertical={false} />
                      <XAxis
                        dataKey="S"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v: number) =>
                          v.toFixed(Math.max(2, greekRateAxis.decimals))
                        }
                        tick={AXIS_TICK}
                        stroke={AXIS_STROKE}
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
                        tick={AXIS_TICK}
                        stroke={AXIS_STROKE}
                        width={64}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        separator=": "
                        content={coarse ? () => null : undefined}
                        labelFormatter={(v) => `Spot ${formatRate(Number(v))}`}
                        formatter={(v) => [g.format(Number(v)), g.title]}
                      />
                      <ReferenceLine x={base.S} {...REFERENCE_LINE} />
                      <Line
                        dataKey={(d: Greeks) => g.scale(d[g.key])}
                        name={g.title}
                        stroke={HEDGE_STYLE.option.color}
                        strokeWidth={LINE_WIDTH}
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
