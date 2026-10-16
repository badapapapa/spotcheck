import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Advanced } from "../components/advanced/Advanced";

export const metadata: Metadata = {
  title: "Hedging: forwards and options · SpotCheck",
};

export default function AdvancedPage() {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hedging: forwards and options
        </h1>
        <p className="text-muted-foreground">
          For the same scenario as the{" "}
          <Link href="/" className="underline underline-offset-2">
            planner
          </Link>
          : what locking a forward or buying an option would cost today, and how
          each would have worked out in the past.
        </p>
      </section>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Advanced />
      </Suspense>
    </div>
  );
}
