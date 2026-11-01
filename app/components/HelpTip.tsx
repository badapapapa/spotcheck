"use client";

import { lazy, Suspense } from "react";

// Loaded after the page, like the currency picker, so the popover code
// doesn't hold up the first paint. The placeholder looks the same.
const HelpTipPopover = lazy(() =>
  import("./HelpTipPopover").then((m) => ({ default: m.HelpTipPopover })),
);

/**
 * A small "i" next to a term that opens a plain-English "About …"
 * note. The visible circle is 24px; the button around it is 44px so it is
 * easy to tap.
 */
export function HelpTip(props: {
  term: string;
  children: string;
  /** Inside a line of text: the 44px tap area overlaps the words around it
   * instead of pushing them apart. */
  inline?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <span
          className={`-my-2.5 inline-flex size-11 shrink-0 items-center justify-center ${props.inline ? "-mx-1.5" : ""}`}
        >
          <span
            aria-hidden
            className="flex size-[22px] items-center justify-center rounded-full border-[1.5px] border-input text-chart font-semibold text-accent"
          >
            i
          </span>
        </span>
      }
    >
      <HelpTipPopover {...props} />
    </Suspense>
  );
}
