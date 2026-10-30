"use client";

import { ChartLine, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Variant = "top" | "bottom";

const TABS = [
  { href: "/", label: "Planner", Icon: ChartLine },
  { href: "/advanced", label: "Hedging", Icon: ShieldCheck },
] as const;

/**
 * Planner / Hedging tabs that carry the scenario across in the URL. "top" sits
 * in the header on desktop; "bottom" is the fixed thumb-reach bar on phones
 * (DESIGN.md §7). Only one is displayed at a time, so each link appears once
 * to assistive tech.
 */
export function SiteNav({ variant }: { variant: Variant }) {
  return (
    <Tabs
      variant={variant}
      pathname={usePathname()}
      query={useSearchParams().toString()}
    />
  );
}

/**
 * The same tabs without the query string, rendered into the static HTML so
 * the header has its final size before any JavaScript runs (no layout shift).
 */
export function SiteNavFallback({ variant }: { variant: Variant }) {
  return <Tabs variant={variant} pathname="" query="" />;
}

function Tabs({
  variant,
  pathname,
  query,
}: {
  variant: Variant;
  pathname: string;
  query: string;
}) {
  return (
    <nav
      aria-label="Sections"
      className={
        variant === "top"
          ? "hidden h-full items-stretch gap-2 lg:flex"
          : "fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-2 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      }
    >
      {TABS.map(({ href, label, Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            // The href changes as the scenario changes; prefetching each new
            // URL would cause a request every time someone edits a field.
            prefetch={false}
            href={query ? `${href}?${query}` : href}
            aria-current={active ? "page" : undefined}
            className={
              variant === "top"
                ? `flex min-h-11 items-center border-b-[3px] px-3 text-[15px] font-semibold ${
                    active
                      ? "border-highlight text-heading"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`
                : `flex flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                    active ? "text-heading" : "text-muted-foreground"
                  }`
            }
          >
            {variant === "bottom" && (
              <Icon aria-hidden className="size-5" strokeWidth={2} />
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
