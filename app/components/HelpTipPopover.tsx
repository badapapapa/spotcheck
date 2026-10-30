"use client";

import { Popover } from "@base-ui/react/popover";

/** The interactive help tip (see HelpTip). Base UI handles focus, Esc and outside clicks. */
export function HelpTipPopover({
  term,
  children,
}: {
  term: string;
  children: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`What is ${term}?`}
        className="group -my-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full align-middle"
      >
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full border-[1.5px] border-input font-heading text-[13px] font-bold text-link group-hover:border-primary group-data-[popup-open]:border-primary"
        >
          i
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} className="z-50">
          <Popover.Popup className="max-w-[min(20rem,var(--available-width))] rounded-lg border bg-card p-3 text-foreground shadow-[var(--shadow-panel)] outline-none">
            <Popover.Title className="text-sm font-semibold">
              What is {term}?
            </Popover.Title>
            <Popover.Description className="mt-1 text-sm text-muted-foreground">
              {children}
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
