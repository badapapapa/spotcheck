"use client";

// The current scenario's query string, shared by every internal link (the
// nav tabs, "Back to the planner", the Hedging intro's link). The planner
// writes the URL only after a 300 ms pause, through history.replaceState,
// which Next's useSearchParams doesn't see, so links read this instead: it
// changes on every edit.

import { useSyncExternalStore } from "react";

let current: string | null = null;
const listeners = new Set<() => void>();

/** Called by usePlannerState with the serialised state on every change. */
export function publishScenario(query: string): void {
  if (query === current) return;
  current = query;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Until a planner page publishes, the page's own query string. */
function snapshot(): string {
  return current ?? window.location.search.slice(1);
}

export function useScenarioQuery(): string {
  // The static HTML has no scenario; React swaps in the real one on hydration.
  return useSyncExternalStore(subscribe, snapshot, () => "");
}

/** `href` with the current scenario attached, for links between pages. */
export function withScenario(href: string, query: string): string {
  return query ? `${href}?${query}` : href;
}
