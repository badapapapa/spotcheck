"use client";

import { Check, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
    <Button type="button" variant="outline" onClick={copy} aria-live="polite">
      {copied ? <Check aria-hidden /> : <LinkIcon aria-hidden />}
      {copied ? "Link copied" : "Copy link to this scenario"}
    </Button>
  );
}
