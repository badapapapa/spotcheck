import { Suspense } from "react";
import { Planner, PlannerFallback } from "./components/Planner";

export default function Home() {
  return (
    <div className="layout pt-6 sm:pt-10 lg:pt-16">
      {/* The question is static, outside the planner's Suspense boundary, so
          it paints before any script runs and is never re-rendered. */}
      <div className="col-main lg:row-start-1">
        <h1 className="t-display">
          What difference does your exchange strategy make?
        </h1>
        <p className="t-lede mt-3 sm:mt-5">
          How four ways of converting currency played out across past exchange
          rates.
        </p>
      </div>
      {/* useSearchParams needs a Suspense boundary in a static export. The
          fallback has the planner's shape, so nothing jumps when it loads. */}
      <Suspense fallback={<PlannerFallback />}>
        <Planner />
      </Suspense>
    </div>
  );
}
