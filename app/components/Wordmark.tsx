import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

/**
 * The spot motif (DESIGN.md §5): a dot on two hairlines, a crosshair at one
 * point in history. The same drawing is app/icon.svg and the touch icon.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        d="M12 2.5v19M2.5 12h19"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="12" cy="12" r="4.25" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link
      href="/"
      // No prefetch: it would fetch the page payload on every load.
      prefetch={false}
      className="-ml-1 flex min-h-11 items-center gap-2 px-1 font-display text-[23px] leading-none font-normal tracking-[-0.01em] text-ink"
    >
      <LogoMark className="size-6 text-ink" />
      {SITE_NAME}
    </Link>
  );
}
