// Renders the comparison table to HTML (no browser needed) and checks its
// wording and styling against the no-advice rule.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { replay } from "@/engine/replay.ts";
import { loadUsd } from "@/engine/__tests__/helpers.ts";
import { STRATEGY_IDS } from "@/engine/types.ts";
import { ComparisonTable } from "@/app/components/ComparisonTable.tsx";
import { formatSgd } from "../format.ts";
import { STRATEGY_STYLE } from "../strategy-style.ts";
import { BANNED_IN_UI_TEXT as ADVISORY } from "@/tests/advisory-patterns.ts";

const scenario = {
  currency: "USD",
  amount: 15_000,
  startDate: "2026-10-17",
  deadline: "2027-08-01",
  tranches: 6,
  spread: 0.005,
};

describe("ComparisonTable", () => {
  const r = replay(loadUsd(), scenario, { targetBelowSpot: 0.02 });
  const html = renderToStaticMarkup(
    createElement(ComparisonTable, {
      caption: "SGD cost of each strategy across historical windows",
      rowHeader: "Strategy",
      rows: STRATEGY_IDS.map((id) => ({
        id,
        label: STRATEGY_STYLE[id].label,
        color: STRATEGY_STYLE[id].color,
        summary: r.stats[id].summary,
      })),
    }),
  );
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const rows = [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(
    (m) => m[0],
  );

  it("shows the same three measures for every strategy", () => {
    expect(text).toMatch(/Median Middle 90% Worst case/);
    for (const id of STRATEGY_IDS) {
      const s = r.stats[id].summary;
      for (const v of [s.median, s.p5, s.p95, s.max]) {
        expect(text).toContain(formatSgd(v));
      }
    }
    expect(rows).toHaveLength(1 + STRATEGY_IDS.length);
  });

  it("styles every strategy row the same", () => {
    // Strip the per-strategy colour key and label; what's left must match.
    const shape = (row: string) =>
      row.replace(/style="[^"]*"/g, "").replace(/>[^<]*</g, "><");
    const body = rows.slice(1).map(shape);
    expect(new Set(body).size).toBe(1);
  });

  it("never uses advisory wording", () => {
    for (const banned of ADVISORY) expect(text).not.toMatch(banned);
  });
});
