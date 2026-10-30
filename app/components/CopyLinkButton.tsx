"use client";

import { Check, Link as LinkIcon } from "lucide-react";
import { useState } from "react";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", window.location.href);
    }
  }
  return (
    <button
      type="button"
      className="btn-primary"
      onClick={copy}
      aria-live="polite"
    >
      {copied ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <LinkIcon aria-hidden className="size-4" />
      )}
      {copied ? "Link copied" : "Copy link"}
      {!copied && <span className="sr-only"> to this scenario</span>}
    </button>
  );
}
