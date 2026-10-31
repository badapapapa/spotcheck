"use client";

import { useEffect } from "react";

/**
 * The page-level error boundary. It renders inside the root layout, so the
 * header, the nav and "Historical data, not advice" stay on screen
 * (CLAUDE.md rule 3) instead of Next's bare "This page couldn't load". The
 * way out is the default scenario, without the query that may have caused
 * the error.
 */
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("SpotCheck hit an error on this page:", error);
  }, [error]);
  return (
    <div className="page pt-10 lg:pt-16" data-testid="page-error">
      <h1 className="t-h1">Something went wrong on this page</h1>
      <p className="t-lede prose-measure mt-5">
        SpotCheck couldn&apos;t show this scenario. Nothing was saved or sent
        anywhere. You can try again, or start from the default plan.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* A full page load, not a client-side navigation: from "/?…" to "/"
            the route doesn't change, so the boundary would stay up. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="btn-primary">
          Open the planner with the default plan
        </a>
        <button type="button" className="btn-secondary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
