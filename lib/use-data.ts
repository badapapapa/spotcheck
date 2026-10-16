"use client";

import { useEffect, useState } from "react";

export type Loadable<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T };

/** Runs `load` whenever `key` changes and tracks its state. */
export function useLoad<T>(key: string, load: () => Promise<T>): Loadable<T> {
  const [state, setState] = useState<{ key: string; value: Loadable<T> }>({
    key,
    value: { status: "loading" },
  });
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setState({ key, value: { status: "ready", data } }),
      (err: unknown) =>
        live &&
        setState({
          key,
          value: {
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          },
        }),
    );
    return () => {
      live = false;
    };
    // `load` is expected to depend only on `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // While a new key loads, report loading rather than stale data.
  return state.key === key ? state.value : { status: "loading" };
}
