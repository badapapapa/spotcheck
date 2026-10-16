import { Suspense } from "react";
import { Planner } from "./components/Planner";

export default function Home() {
  return (
    // useSearchParams needs a Suspense boundary in a static export.
    <Suspense
      fallback={<p className="text-muted-foreground">Loading planner…</p>}
    >
      <Planner />
    </Suspense>
  );
}
