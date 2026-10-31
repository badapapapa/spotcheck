"use client";

import Link from "next/link";
import { useScenarioQuery, withScenario } from "@/lib/scenario-link.ts";

/** An internal link that carries the current scenario (see scenario-link.ts). */
export function ScenarioLink({
  href,
  className = "link",
  children,
}: {
  href: "/" | "/advanced" | "/how-it-works";
  className?: string;
  children: React.ReactNode;
}) {
  const query = useScenarioQuery();
  return (
    // No prefetch: the href changes with every edit.
    <Link
      href={withScenario(href, query)}
      prefetch={false}
      className={className}
    >
      {children}
    </Link>
  );
}
