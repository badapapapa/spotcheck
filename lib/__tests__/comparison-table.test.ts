// Renders the planner's comparisons to HTML (no browser needed) and checks
// them against the no-advice rules: the same measures for every strategy,
// a fixed order whatever the results, styling that never depends on the
// results, and no verdicts.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { addDays } from "@/engine/calendar.ts";
import { replay, type ReplayResult } from "@/engine/replay.ts";
import { loadFx } from "@/engine/__tests__/helpers.ts";
import { STRATEGY_IDS } from "@/engine/types.ts";
import { ComparisonTable } from "@/app/components/ComparisonTable.tsx";
import { Glance } from "@/app/components/Glance.tsx";
import {
  BANNED_IN_UI_TEXT,
  STRATEGY_NAMES,
  namesRanking,
} from "@/tests/advisory-patterns.ts";
import { formatSgd } from "../format.ts";
import { STRATEGY_STYLE } from "../strategy-style.ts";
import { parseState } from "../url-state.ts";

/** Very different histories, so a result-dependent order would show. */
function scenario(code: string, days: number, tranches: number) {
  const fx = loadFx(code);
  const startDate = fx.dates.at(-1)!;
  const s = {
    currency: code,
    amount: 15_000,
    startDate,
    deadline: addDays(startDate, days),
    tranches,
    spread: 0.005,
  };
  return replay(fx, s, { targetBelowSpot: 0.02 });
}
const RESULTS: [string, ReplayResult][] = [
  ["USD 9 months", scenario("USD", 290, 6)],
  ["JPY 1 month", scenario("JPY", 30, 2)],
  ["VND 2 years", scenario("VND", 730, 12)],
  ["EUR 6 months, 1 conversion", scenario("EUR", 180, 1)],
  ["BND (peg)", scenario("BND", 290, 6)],
];

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/\s+/g, " ");
/** Names in the order they first appear in a block of text. */
const order = (t: string) =>
  STRATEGY_NAMES.map((n) => [n, t.indexOf(n)] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([n]) => n);

function table(r: ReplayResult) {
  return renderToStaticMarkup(
    createElement(ComparisonTable, {
      caption: "SGD cost of each strategy across comparable past periods",
      rowHeader: "Strategy",
      reference: "all at once",
      rows: STRATEGY_IDS.map((id) => ({
        id,
        label: STRATEGY_STYLE[id].label,
        color: STRATEGY_STYLE[id].color,
        summary: r.stats[id].summary,
        vsReference:
          id === "lumpSum"
            ? undefined
            : r.stats[id].summary.median - r.stats.lumpSum.summary.median,
        cheaperShare: id === "lumpSum" ? undefined : r.stats[id].beatLumpSum,
      })),
    }),
  );
}
function glance(r: ReplayResult) {
  return renderToStaticMarkup(
    createElement(Glance, {
      result: r,
      state: parseState(new URLSearchParams(), "2026-10-31"),
      pegged: false,
      stale: false,
      active: null,
      pinned: null,
      onHover: () => {},
      onToggle: () => {},
    }),
  );
}
/** A row's markup with its content stripped: what's left is its styling. */
const shape = (row: string) =>
  row.replace(/style="[^"]*"/g, "").replace(/>[^<]*</g, "><");
const bodyRows = (html: string) =>
  [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].flatMap((b) =>
    [...b[1]!.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map((m) => m[0]),
  );

describe.each(RESULTS)("comparisons for %s", (_, r) => {
  for (const [name, render] of [
    ["ComparisonTable", table],
    ["Glance", glance],
  ] as const) {
    const html = render(r);
    const t = text(html);

    it(`${name}: lists the strategies in the fixed order`, () => {
      expect(order(t)).toEqual(STRATEGY_NAMES);
    });

    it(`${name}: styles rows the same, whatever the results`, () => {
      const rows = bodyRows(html).map(shape);
      expect(rows).toHaveLength(STRATEGY_IDS.length);
      // All at once is the fixed reference row (its "vs" cell reads "–");
      // the other three must match each other exactly…
      expect(new Set(rows.slice(1)).size).toBe(1);
      // …and every row must look the same in every history tested.
      expect(rows).toEqual(bodyRows(render(RESULTS[0]![1])).map(shape));
    });

    it(`${name}: uses no good/bad colour or emphasis`, () => {
      expect(html).not.toMatch(
        /\b(text|bg|border)-(negative|positive|caution|success|danger|red|green|emerald|rose)\b/,
      );
      expect(html).not.toMatch(/var\(--(negative|caution|accent)\)/);
    });

    it(`${name}: no verdicts or advisory wording`, () => {
      expect(namesRanking(t)).toBeUndefined();
      for (const banned of BANNED_IN_UI_TEXT) expect(t).not.toMatch(banned);
    });
  }

  it("ComparisonTable shows every measure for every strategy", () => {
    const t = text(table(r));
    for (const id of STRATEGY_IDS) {
      const s = r.stats[id].summary;
      for (const v of [s.median, s.p5, s.p95, s.max])
        expect(t).toContain(formatSgd(v));
    }
    expect(t).toMatch(
      /Median Median vs all at once Middle 90% Most expensive past period Cheaper than all at once/,
    );
  });
});
