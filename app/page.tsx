import { Suspense } from "react";
import { Planner, PlannerFallback } from "./components/Planner";

export default function Home() {
  return (
    <div className="layout pt-10 lg:pt-16">
      {/* The question is static, outside the planner's Suspense boundary, so
          it paints before any script runs and is never re-rendered. */}
      <div className="col-main lg:row-start-1">
        <h1 className="t-display">When should you exchange your money?</h1>
        <p className="t-lede mt-5">
          SpotCheck tests four ways of converting Singapore dollars against
          every comparable period since 1999.
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
