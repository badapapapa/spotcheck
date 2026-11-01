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
        aria-label={`About ${term}`}
        className="group -my-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full align-middle"
      >
        <span
          aria-hidden
          className="flex size-[22px] items-center justify-center rounded-full border-[1.5px] border-input text-chart font-semibold text-accent group-hover:border-ink group-data-[popup-open]:border-accent"
        >
          i
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} className="z-50">
          <Popover.Popup className="max-w-[min(20rem,var(--available-width))] rounded-lg border bg-surface p-3 text-foreground shadow-[var(--shadow-pop)] outline-none">
            <Popover.Title className="text-sm font-semibold">
              About {term}
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
