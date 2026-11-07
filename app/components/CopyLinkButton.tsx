"use client";

import { Check, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { serializeState, type PlannerState } from "@/lib/url-state.ts";

/**
 * Copies a link to exactly this scenario. It is built from the state on
 * screen, not from the address bar (which follows typing 300 ms later), and
 * names every setting, start date included, so the recipient's "today"
 * never changes what they see.
 */
export function CopyLinkButton({
  state,
  lastValid = false,
}: {
  state: PlannerState;
  /**
   * A field holds an entry that isn't valid yet: the link is to the last
   * valid one (the plan the results are for), and says so (F09).
   */
  lastValid?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = `${window.location.origin}${window.location.pathname}?${serializeState(state, { complete: true })}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }
  return (
    <button
      type="button"
      // Secondary: sharing is not the page's main action, and green is kept
      // for the brand, links and the user's own selection (DESIGN.md §2).
      className="btn-secondary"
      onClick={copy}
      aria-live="polite"
    >
      {copied ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <LinkIcon aria-hidden className="size-4" />
      )}
      {copied
        ? "Link copied"
        : lastValid
          ? "Copy link to that entry"
          : "Copy link"}
      {!copied && !lastValid && (
        <span className="sr-only"> to this scenario</span>
      )}
    </button>
  );
}
