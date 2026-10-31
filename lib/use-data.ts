"use client";

import { useCallback, useEffect, useState } from "react";
import { DataLoadError } from "./data.ts";

export type Loadable<T> =
  | { status: "loading" }
  | { status: "error"; error: string; retry: () => void }
  | { status: "ready"; data: T; stale?: boolean };

/**
 * Runs `load` whenever `key` changes and tracks its state. With
 * `keepPrevious`, the last result stays on screen (marked stale) while the
 * next one loads, so results don't flash away on every keystroke. An error
 * carries `retry`, which runs `load` again.
 */
export function useLoad<T>(
  key: string | null,
  load: () => Promise<T>,
  { keepPrevious = false } = {},
): Loadable<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string | null;
    attempt: number;
    value: Loadable<T>;
  }>({ key, attempt, value: { status: "loading" } });
  const [previous, setPrevious] = useState<T | undefined>(undefined);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  useEffect(() => {
    if (key === null) return;
    let live = true;
    load().then(
      (data) => {
        if (!live) return;
        setState({ key, attempt, value: { status: "ready", data } });
        setPrevious(data);
      },
      (err: unknown) =>
        live &&
        setState({
          key,
          attempt,
          value: {
            status: "error",
            // Data files explain themselves; anything else (the worker's
            // own errors) keeps its message.
            error:
              err instanceof DataLoadError || err instanceof Error
                ? err.message
                : String(err),
            retry,
          },
        }),
    );
    return () => {
      live = false;
    };
    // `load` is expected to depend only on `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  if (state.key === key && state.attempt === attempt) return state.value;
  if (keepPrevious && previous !== undefined)
    return { status: "ready", data: previous, stale: true };
  return { status: "loading" };
}
