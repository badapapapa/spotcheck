"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

/**
 * True on touch-first devices. Charts there show the values under the
 * finger in a fixed row below the chart instead of a floating tooltip,
 * which on a phone stays open after a tap and covers the chart.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
