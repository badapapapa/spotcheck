import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

/**
 * SpotCheck's mark: a navy tile with two opposing exchange arrows. The same
 * drawing is used for app/icon.svg and the apple-touch-icon (DESIGN.md §7).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#0A2463" />
      <path
        d="M8.5 12.5h14l-3.6-3.6M23.5 19.5h-14l3.6 3.6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link
      href="/"
      // No prefetch: it would fetch the page payload on every load.
      prefetch={false}
      className="flex min-h-11 items-center gap-2.5 font-heading text-[22px] font-extrabold tracking-tight text-heading"
    >
      <LogoMark className="size-8" />
      {SITE_NAME}
    </Link>
  );
}
