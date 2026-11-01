// How each strategy is drawn. Colour follows the strategy everywhere; the
// marker shape is a second cue so identity never depends on colour alone.

import type { StrategyId } from "@/engine/types.ts";

export const STRATEGY_STYLE: Record<
  StrategyId,
  {
    label: string;
    /** A plain-English gloss under a name that is jargon ("tranches"). */
    subtitle?: string;
    color: string;
    shape: "circle" | "diamond" | "square" | "triangle";
    blurb: string;
  }
> = {
  lumpSum: {
    label: "All at once",
    color: "var(--series-1)",
    shape: "circle",
    blurb: "Convert everything on the start date.",
  },
  tranches: {
    label: "Equal tranches",
    subtitle: "convert in equal parts",
    color: "var(--series-2)",
    shape: "diamond",
    blurb: "Convert equal amounts on evenly spaced dates up to the deadline.",
  },
  wait: {
    label: "Wait until deadline",
    color: "var(--series-3)",
    shape: "square",
    blurb: "Convert everything on the deadline.",
  },
  target: {
    label: "Target rate",
    color: "var(--series-4)",
    shape: "triangle",
    blurb:
      "Convert everything the first day the rate reaches the target; otherwise on the deadline.",
  },
};
