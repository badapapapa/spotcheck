"use client";

import { useEffect, useState } from "react";

export type Loadable<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T; stale?: boolean };

/**
 * Runs `load` whenever `key` changes and tracks its state. With
 * `keepPrevious`, the last result stays on screen (marked stale) while the
 * next one loads, so results don't flash away on every keystroke.
 */
export function useLoad<T>(
  key: string | null,
  load: () => Promise<T>,
  { keepPrevious = false } = {},
): Loadable<T> {
  const [state, setState] = useState<{
    key: string | null;
    value: Loadable<T>;
  }>({
    key,
    value: { status: "loading" },
  });
  const [previous, setPrevious] = useState<T | undefined>(undefined);
  useEffect(() => {
    if (key === null) return;
    let live = true;
    load().then(
      (data) => {
        if (!live) return;
        setState({ key, value: { status: "ready", data } });
        setPrevious(data);
      },
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
  if (state.key === key) return state.value;
  if (keepPrevious && previous !== undefined)
    return { status: "ready", data: previous, stale: true };
  return { status: "loading" };
}
