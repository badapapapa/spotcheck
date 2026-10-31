"use client";

import { Info } from "lucide-react";
import { DATA_NOTES } from "@/lib/data-notes.ts";
import { useScenarioQuery } from "@/lib/scenario-link.ts";

/** A caution note about a currency's data (DESIGN.md: amber, with an icon). */
export function DataNote({
  code,
  className = "",
}: {
  code: string;
  className?: string;
}) {
  const note = DATA_NOTES[code];
  if (!note) return null;
  return (
    <p className={`t-small flex gap-2 ${className}`} data-testid="data-note">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-caution" />
      <span>{note}</span>
    </p>
  );
}

/** How it works: the note for the scenario's currency, if it has one. */
export function ScenarioDataNote() {
  const code = new URLSearchParams(useScenarioQuery()).get("c") ?? "";
  return <DataNote code={code.toUpperCase()} className="mt-4" />;
}
