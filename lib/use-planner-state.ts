"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { todayInSingapore } from "./dates.ts";
import { parseState, serializeState, type PlannerState } from "./url-state.ts";

/** Planner state read from, and written to, the URL query string. */
export function usePlannerState(): [
  PlannerState,
  (next: PlannerState) => void,
  string,
] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [today] = useState(() => todayInSingapore());
  const state = useMemo(
    () => parseState(new URLSearchParams(params.toString()), today),
    [params, today],
  );
  const setState = useCallback(
    (next: PlannerState) => {
      router.replace(`${pathname}?${serializeState(next).toString()}`, {
        scroll: false,
      });
    },
    [router, pathname],
  );
  return [state, setState, today];
}
