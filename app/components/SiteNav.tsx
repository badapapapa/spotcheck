"use client";

import { BookOpen, ChartLine, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useScenarioQuery, withScenario } from "@/lib/scenario-link.ts";

type Variant = "top" | "bottom";

/**
 * Every tab carries the scenario, so moving between pages (How it works
 * included) and back never loses it.
 */
const TABS = [
  { href: "/", label: "Planner", Icon: ChartLine },
  { href: "/advanced", label: "Hedging", Icon: ShieldCheck },
  { href: "/how-it-works", label: "How it works", Icon: BookOpen },
] as const;

/**
 * "top" is the header nav on laptops; "bottom" is the fixed thumb-reach bar
 * on phones (DESIGN.md §7). Only one is displayed at a time, so each link
 * appears once to assistive tech.
 */
export function SiteNav({ variant }: { variant: Variant }) {
  return (
    <Tabs
      variant={variant}
      pathname={usePathname()}
      query={useScenarioQuery()}
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
          ? "hidden h-full items-stretch gap-1 lg:flex"
          : "fixed inset-x-0 bottom-0 z-30 grid h-14 grid-cols-3 border-t bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
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
            href={withScenario(href, query)}
            aria-current={active ? "page" : undefined}
            className={
              variant === "top"
                ? `flex min-h-11 items-center border-b-2 px-3 text-ui transition-colors ${
                    active
                      ? "border-accent font-medium text-ink"
                      : "border-transparent text-muted-foreground hover:text-ink"
                  }`
                : `flex flex-col items-center justify-center gap-0.5 text-annotation font-medium ${
                    active ? "text-accent" : "text-muted-foreground"
                  }`
            }
          >
            {variant === "bottom" && (
              <Icon aria-hidden className="size-5" strokeWidth={1.75} />
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
