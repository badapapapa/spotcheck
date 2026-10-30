// Colours for the hedging views. "Unhedged" is the same thing as the
// planner's "wait until deadline", so it keeps that colour.

import type { HedgeId } from "@/engine/hedge-replay.ts";

export const HEDGE_STYLE: Record<
  HedgeId,
  {
    label: string;
    short: string;
    color: string;
    shape: "square" | "circle" | "diamond";
  }
> = {
  unhedged: {
    label: "Unhedged (convert on deadline)",
    short: "Unhedged",
    color: "var(--series-3)",
    shape: "square",
  },
  forward: {
    label: "Forward locked on day one",
    short: "Forward",
    color: "var(--series-1)",
    shape: "circle",
  },
  option: {
    label: "Call option bought on day one",
    short: "Call option",
    color: "var(--series-2)",
    shape: "diamond",
  },
};
