// The whole scenario lives in the URL query string, so a link reproduces it
// exactly and nothing is stored anywhere else.

import { z } from "zod";
import { daysBetween } from "@/engine/calendar.ts";
import { findCurrency } from "@/engine/currencies.ts";
import type { Scenario } from "@/engine/types.ts";
import { defaultDeadline } from "./dates.ts";

export type PlannerState = {
  scenario: Scenario;
  /** Target as a fraction below the starting spot (0.02 = 2%). */
  targetBelowSpot: number;
  /** Advanced tab: option strike as a fraction of spot (1 = at the money). */
  strikePct: number;
  /** Advanced tab: volatility override; undefined = realised volatility. */
  volOverride?: number;
  /** Advanced tab: realised-volatility lookback in observations. */
  volLookback: VolLookback;
};

/** Realised-volatility lookbacks offered, in trading days. */
export const VOL_LOOKBACKS = [60, 90, 250] as const;
export type VolLookback = (typeof VOL_LOOKBACKS)[number];

export const LIMITS = {
  amount: { min: 1, max: 1e12 },
  tranches: { min: 1, max: 24 },
  spreadPct: { min: 0, max: 5 },
  targetPct: { min: 0, max: 20 },
  strikePct: { min: 80, max: 120 },
  volPct: { min: 1, max: 100 },
  minWindowDays: 7,
  maxWindowDays: 3 * 365,
} as const;

export const DEFAULTS = {
  currency: "USD",
  amount: 15_000,
  tranches: 6,
  spreadPct: 0.5,
  targetPct: 2,
  strikePct: 100,
  // A year of trading days: steadier than 60/90 and less sensitive to a
  // calm or stormy couple of months.
  volLookback: 250 as VolLookback,
};

const isoDate = z.iso.date();
const num = (min: number, max: number) =>
  z.coerce.number().finite().min(min).max(max);

/** Parses each field on its own, so one bad value falls back to its default. */
function field<T>(schema: z.ZodType<T>, raw: string | null, fallback: T): T {
  if (raw === null || raw === "") return fallback;
  const r = schema.safeParse(raw);
  return r.success ? r.data : fallback;
}

export function parseState(
  params: URLSearchParams,
  today: string,
): PlannerState {
  const currency = field(
    z.string(),
    params.get("c"),
    DEFAULTS.currency,
  ).toUpperCase();
  const startDate = field(isoDate, params.get("s"), today);
  let deadline = field(isoDate, params.get("d"), defaultDeadline(startDate));
  const window = daysBetween(startDate, deadline);
  if (window < LIMITS.minWindowDays || window > LIMITS.maxWindowDays) {
    deadline = defaultDeadline(startDate);
  }
  const vol = field(
    num(LIMITS.volPct.min, LIMITS.volPct.max),
    params.get("v"),
    undefined as number | undefined,
  );
  return {
    scenario: {
      currency: findCurrency(currency) ? currency : DEFAULTS.currency,
      amount: field(
        num(LIMITS.amount.min, LIMITS.amount.max),
        params.get("a"),
        DEFAULTS.amount,
      ),
      startDate,
      deadline,
      tranches: Math.round(
        field(
          num(LIMITS.tranches.min, LIMITS.tranches.max),
          params.get("k"),
          DEFAULTS.tranches,
        ),
      ),
      spread:
        field(
          num(LIMITS.spreadPct.min, LIMITS.spreadPct.max),
          params.get("sp"),
          DEFAULTS.spreadPct,
        ) / 100,
    },
    targetBelowSpot:
      field(
        num(LIMITS.targetPct.min, LIMITS.targetPct.max),
        params.get("t"),
        DEFAULTS.targetPct,
      ) / 100,
    strikePct:
      field(
        num(LIMITS.strikePct.min, LIMITS.strikePct.max),
        params.get("ks"),
        DEFAULTS.strikePct,
      ) / 100,
    volOverride: vol === undefined ? undefined : vol / 100,
    volLookback:
      VOL_LOOKBACKS.find((n) => String(n) === params.get("vl")) ??
      DEFAULTS.volLookback,
  };
}

/** Rounds away float noise from percentage conversions (0.5 not 0.49999…). */
const pct = (fraction: number) => String(Number((fraction * 100).toFixed(4)));

export function serializeState(state: PlannerState): URLSearchParams {
  const { scenario: s } = state;
  const p = new URLSearchParams({
    c: s.currency,
    a: String(s.amount),
    s: s.startDate,
    d: s.deadline,
    k: String(s.tranches),
    sp: pct(s.spread),
    t: pct(state.targetBelowSpot),
  });
  if (state.strikePct !== DEFAULTS.strikePct / 100)
    p.set("ks", pct(state.strikePct));
  if (state.volOverride !== undefined) p.set("v", pct(state.volOverride));
  if (state.volLookback !== DEFAULTS.volLookback)
    p.set("vl", String(state.volLookback));
  return p;
}
