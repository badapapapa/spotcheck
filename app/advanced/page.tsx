import type { Metadata } from "next";
import { Suspense } from "react";
import { Advanced } from "../components/advanced/Advanced";

export const metadata: Metadata = {
  title: "Hedging: forwards and options · SpotCheck",
};

export default function AdvancedPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <Advanced />
    </Suspense>
  );
}
