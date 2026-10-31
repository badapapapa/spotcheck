import type { Metadata } from "next";
import { Suspense } from "react";
import { Advanced } from "../components/advanced/Advanced";
import { ScenarioLink } from "../components/ScenarioLink";

export const metadata: Metadata = {
  title: "Hedging: forwards and options | SpotCheck",
};

export default function AdvancedPage() {
  return (
    <div className="page pt-10 lg:pt-16">
      {/* Static, so it paints before any script runs. */}
      <div className="max-w-4xl">
        <h1 className="t-h1">Hedging: forwards and options</h1>
        <p className="t-lede mt-5">
          What fixing your rate today with a forward, or capping it with an
          option, would cost for the same plan as the{" "}
          <ScenarioLink href="/">planner</ScenarioLink>, and how each would have
          worked out in past periods.
        </p>
      </div>
      <Suspense
        fallback={
          <div aria-hidden className="mt-8 space-y-6">
            <div className="skeleton h-11 w-full max-w-xl" />
            <div className="skeleton h-11 w-64" />
            {/* Taller than any screen, so the footer never jumps. */}
            <div className="skeleton mt-12 h-[60rem]" />
          </div>
        }
      >
        <Advanced />
      </Suspense>
    </div>
  );
}
