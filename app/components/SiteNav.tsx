"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Planner / Hedging tabs that carry the scenario across in the URL. */
export function SiteNav() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const tabs = [
    { href: "/", label: "Planner" },
    { href: "/advanced", label: "Hedging" },
  ];
  return (
    <nav aria-label="Sections" className="flex gap-1 text-sm">
      {tabs.map((t) => {
        const active =
          t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            // The href changes as the scenario changes; prefetching each new
            // URL would cause a request every time someone edits a field.
            prefetch={false}
            href={query ? `${t.href}?${query}` : t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 ${active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
