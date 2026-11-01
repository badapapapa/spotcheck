// When each strategy converts, as fractions of the plan (0 = the start
// date, 1 = the deadline), for the conceptual timing diagram on How it
// works. It shows the rules, not a result: no rates and no figures.
// lib/__tests__/timing.test.ts checks it against the engine's own runs.

import type { StrategyId } from "@/engine/types.ts";

export type TimingMark = {
  at: number;
  /** A conversion that happens only if an earlier one didn't (the target's fallback). */
  fallback?: boolean;
};

export type Timing = { marks: TimingMark[]; caption: string };

/** The four rules, in the fixed order, with `tranches` equal parts. */
export function timing(tranches: number): Record<StrategyId, Timing> {
  return {
    lumpSum: { marks: [{ at: 0 }], caption: "Everything on the start date." },
    tranches: {
      marks: Array.from({ length: tranches }, (_, i) => ({
        at: tranches === 1 ? 0 : i / (tranches - 1),
      })),
      caption: `${tranches} equal parts on evenly spaced dates: the first on the start date, the last on the deadline.`,
    },
    wait: { marks: [{ at: 1 }], caption: "Everything on the deadline." },
    target: {
      // Where the target is first reached depends on the history; the mark
      // only says "some day in between".
      marks: [{ at: 0.45 }, { at: 1, fallback: true }],
      caption:
        "Everything on the first day the rate reaches the target; if it never does, on the deadline.",
    },
  };
}
