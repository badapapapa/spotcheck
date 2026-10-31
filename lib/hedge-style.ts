// Colours for the hedging views (DESIGN.md §2). "Unhedged" is the same thing
// as the planner's "Wait until deadline", so it keeps that colour; a forward,
// like "All at once", fixes the cost on day one, so it shares that colour;
// the call option has a colour of its own.

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
    color: "var(--series-option)",
    shape: "diamond",
  },
};
