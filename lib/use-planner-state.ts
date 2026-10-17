"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { todayInSingapore } from "./dates.ts";
import { parseState, serializeState, type PlannerState } from "./url-state.ts";

/** How long typing must pause before the URL is updated. */
export const URL_DEBOUNCE_MS = 300;

/**
 * Planner state, mirrored into the URL query string.
 *
 * The page reads and updates local state immediately. The URL follows
 * 300 ms after the last change, through the native history.replaceState
 * (which Next.js keeps in sync with useSearchParams). So typing "4000" makes
 * one URL update, no router navigation, no network request, and no extra
 * history entries. If the URL changes from outside (a link, back/forward),
 * the state follows it.
 */
export function usePlannerState(): [
  PlannerState,
  (next: PlannerState) => void,
  string,
] {
  const params = useSearchParams();
  const pathname = usePathname();
  const [today] = useState(() => todayInSingapore());
  const query = params.toString();
  const [state, setLocal] = useState(() =>
    parseState(new URLSearchParams(query), today),
  );
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The query string this hook last wrote, to tell our own URL updates apart
  // from outside navigation (a link, back/forward).
  const [written, setWritten] = useState(() =>
    serializeState(state).toString(),
  );

  // Outside navigation: adopt the new URL.
  const [seenQuery, setSeenQuery] = useState(query);
  if (query !== seenQuery) {
    setSeenQuery(query);
    if (query !== written) {
      const next = parseState(new URLSearchParams(query), today);
      setWritten(serializeState(next).toString());
      setLocal(next);
    }
  }

  const setState = useCallback(
    (next: PlannerState) => {
      setLocal(next);
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        const q = serializeState(next).toString();
        setWritten(q);
        window.history.replaceState(
          window.history.state,
          "",
          `${pathname}?${q}`,
        );
      }, URL_DEBOUNCE_MS);
    },
    [pathname],
  );

  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );

  return [state, setState, today];
}
