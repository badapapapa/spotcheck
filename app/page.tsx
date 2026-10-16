import { Suspense } from "react";
import { Planner } from "./components/Planner";

export default function Home() {
  return (
    <div className="space-y-6">
      {/* Static, so it paints before any JavaScript runs. */}
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Exchange money planner
        </h1>
        <p className="text-muted-foreground">
          Enter how much foreign currency you need and by when. SpotCheck
          replays four ways of converting it over every comparable period since
          1999 and shows the range of SGD costs.
        </p>
      </section>
      {/* useSearchParams needs a Suspense boundary in a static export. */}
      <Suspense
        fallback={<p className="text-muted-foreground">Loading planner…</p>}
      >
        <Planner />
      </Suspense>
    </div>
  );
}
