// The whole scenario lives in the URL query string, so a link reproduces it
// exactly and nothing is stored anywhere else.

import { z } from "zod";

// See scripts/fetch/schemas.ts: no eval probe under the site's CSP.
z.config({ jitless: true });
import { findCurrency } from "@/engine/currencies.ts";
import type { Scenario } from "@/engine/types.ts";
import { MAX_TRANCHES, maxTranches, windowError } from "./coverage.ts";
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
  tranches: { min: 1, max: MAX_TRANCHES },
  spreadPct: { min: 0, max: 5 },
  targetPct: { min: 0, max: 20 },
  strikePct: { min: 80, max: 120 },
  volPct: { min: 1, max: 100 },
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
// Whole numbers only, as the form accepts: "k=1.5" falls back to the
// default instead of being rounded to 2.
const whole = (min: number, max: number) => num(min, max).int();

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
  if (windowError(startDate, deadline)) deadline = defaultDeadline(startDate);
  // More conversions than the plan has room for (see maxTranches) falls
  // back like any other value the form would reject.
  const roomFor = maxTranches(startDate, deadline);
  const k = field(
    whole(LIMITS.tranches.min, LIMITS.tranches.max),
    params.get("k"),
    DEFAULTS.tranches,
  );
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
      tranches: k <= roomFor ? k : Math.min(DEFAULTS.tranches, roomFor),
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
    // The strike slider moves in whole percent, so "ks=95.5" falls back.
    strikePct:
      field(
        whole(LIMITS.strikePct.min, LIMITS.strikePct.max),
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

/**
 * The query string for a state. The page's own URL leaves out the Hedging
 * settings while they are at their defaults; `complete` (for Copy link)
 * writes every one, so the recipient sees exactly the same scenario even if
 * the defaults change.
 */
export function serializeState(
  state: PlannerState,
  { complete = false }: { complete?: boolean } = {},
): URLSearchParams {
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
  if (complete || state.strikePct !== DEFAULTS.strikePct / 100)
    p.set("ks", pct(state.strikePct));
  if (state.volOverride !== undefined) p.set("v", pct(state.volOverride));
  if (complete || state.volLookback !== DEFAULTS.volLookback)
    p.set("vl", String(state.volLookback));
  return p;
}
