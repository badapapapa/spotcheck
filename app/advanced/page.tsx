import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Advanced } from "../components/advanced/Advanced";
import { PageTitle } from "../components/PageTitle";

export const metadata: Metadata = {
  title: "Hedging: forwards and options · SpotCheck",
};

export default function AdvancedPage() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <PageTitle title="Hedging: forwards and options">
        For the same scenario as the{" "}
        <Link
          href="/"
          prefetch={false}
          className="text-link underline underline-offset-2"
        >
          planner
        </Link>
        : what locking a forward or buying an option would cost today, and how
        each would have worked out in the past.
      </PageTitle>
      <Suspense
        fallback={
          <div aria-hidden className="space-y-6">
            <div className="skeleton h-11 w-full max-w-xl" />
            <div className="skeleton h-11 w-64" />
            {/* Taller than any screen, so the footer never jumps. */}
            <div className="skeleton h-[60rem]" />
          </div>
        }
      >
        <Advanced />
      </Suspense>
    </div>
  );
}
