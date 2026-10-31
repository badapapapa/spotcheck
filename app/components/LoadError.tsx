"use client";

import { RotateCw } from "lucide-react";

/**
 * A data file that didn't load: what failed in plain words, and a way to try
 * again. The technical detail is in the console (lib/data.ts).
 */
export function LoadError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div role="alert" data-testid="load-error">
      <p className="text-negative">{message}</p>
      <button type="button" className="btn-secondary mt-4" onClick={retry}>
        <RotateCw aria-hidden className="size-4" />
        Try again
      </button>
    </div>
  );
}
