import { describe, expect, it } from "vitest";
import { CURRENCIES } from "@/engine/currencies.ts";
import { daily, loadFx } from "@/engine/__tests__/helpers.ts";
import {
  BANNED_IN_UI_TEXT as ADVISORY,
  comparesStrategies,
  namesRanking,
} from "@/tests/advisory-patterns.ts";
import { trendNote } from "../trend.ts";

describe("trendNote", () => {
  it("reads the first and last rate from the data", () => {
    const note = trendNote(daily("2020-01-01", [1.4, 1.35, 1.3]), "USD");
    expect(note).toBe(
      "Across this history SGD per USD went from 1.4000 (1 Jan 2020) to 1.3000 (3 Jan 2020). " +
        "In periods when the rate fell, converting later cost less; when it rose, it cost more.",
    );
  });

  it("uses the same symmetric words whichever way the rate moved", () => {
    const fell = trendNote(daily("2020-01-01", [1.4, 1.3]), "USD")!;
    const rose = trendNote(daily("2020-01-01", [1.3, 1.4]), "USD")!;
    const tail = (s: string) => s.slice(s.indexOf(". ") + 2);
    expect(tail(fell)).toBe(tail(rose));
  });

  it("says nothing for a peg", () => {
    expect(trendNote(loadFx("BND"), "BND")).toBeUndefined();
  });

  it.each(CURRENCIES.map((c) => c.code))(
    "%s: real figures, and no advice, ranking or comparison",
    (code) => {
      const fx = loadFx(code);
      const note = trendNote(fx, code);
      if (code === "BND") return;
      expect(note).toContain(`SGD per ${code}`);
      for (const banned of ADVISORY) expect(note).not.toMatch(banned);
      expect(namesRanking(note!)).toBeUndefined();
      expect(comparesStrategies(note!)).toBeUndefined();
    },
  );
});
