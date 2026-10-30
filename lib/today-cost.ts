// The converter's headline figure: what converting everything today would
// cost. It is the same arithmetic as the replay's "All at once" strategy
// (amount × today's mid rate × (1 + spread)), so the two always agree; a test
// checks that against the engine for every currency.

import type { Scenario } from "@/engine/types.ts";

export function todayCost(
  scenario: Pick<Scenario, "amount" | "spread">,
  spot: number,
): { withSpread: number; mid: number } {
  const mid = scenario.amount * spot;
  return { withSpread: mid * (1 + scenario.spread), mid };
}
