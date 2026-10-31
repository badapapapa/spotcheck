import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found | SpotCheck",
};

export default function NotFound() {
  return (
    <div className="page pt-10 lg:pt-16">
      <h1 className="t-h1">Page not found</h1>
      <p className="t-lede mt-5">
        There&apos;s nothing at this address. The planner, Hedging and How it
        works are linked at the top of the page.
      </p>
      <p className="mt-6">
        <Link href="/" prefetch={false} className="link">
          Go to the planner
        </Link>
      </p>
    </div>
  );
}
