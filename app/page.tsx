import { Suspense } from "react";
import { PageTitle } from "./components/PageTitle";
import { Planner, ResultsHeader, ResultsSkeleton } from "./components/Planner";

export default function Home() {
  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Static, so it paints before any JavaScript runs. */}
      <PageTitle title="Exchange money planner">
        Replays four ways of converting your money over every comparable period
        since 1999.
      </PageTitle>
      {/* useSearchParams needs a Suspense boundary in a static export. The
          fallback has the planner's shape, so nothing jumps when it loads. */}
      <Suspense fallback={<PlannerFallback />}>
        <Planner />
      </Suspense>
    </div>
  );
}

function PlannerFallback() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[40rem_minmax(0,1fr)] xl:items-start">
      <div className="panel panel-raised converter-min-h" aria-hidden />
      <div className="panel">
        <ResultsHeader />
        <p className="mt-2 h-4 text-xs text-muted-foreground">Loading…</p>
        <ResultsSkeleton />
      </div>
    </div>
  );
}
