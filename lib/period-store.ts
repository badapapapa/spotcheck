"use client";

// The period picked on the timeline. It lives in a tiny store outside the
// planner's React state, so scrubbing the timeline re-renders only the two
// parts that show the period (the timeline and the period detail), not the
// glance, the range chart and the tables, which don't depend on it.

import { useSyncExternalStore } from "react";

type Picked = { key: string; index: number };

export type PeriodStore = {
  get: () => Picked | undefined;
  set: (picked: Picked) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createPeriodStore(): PeriodStore {
  let picked: Picked | undefined;
  const listeners = new Set<() => void>();
  return {
    get: () => picked,
    set: (next) => {
      if (picked?.key === next.key && picked.index === next.index) return;
      picked = next;
      for (const l of listeners) l();
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

/**
 * The selected period's index. `key` identifies the set of periods (their
 * count and length): a new set starts again from the latest, `last`.
 */
export function usePeriod(store: PeriodStore, key: string, last: number) {
  const picked = useSyncExternalStore(store.subscribe, store.get, store.get);
  return picked?.key === key ? picked.index : last;
}
