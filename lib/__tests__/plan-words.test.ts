import { describe, expect, it } from "vitest";
import { planInWords } from "../plan-words.ts";
import { parseState } from "../url-state.ts";

const state = (q: string) => parseState(new URLSearchParams(q), "2026-10-31");

describe("planInWords", () => {
  it("names every setting the results depend on", () => {
    expect(
      planInWords(
        state("c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2"),
      ),
    ).toBe(
      "USD 15,000 by 1 Aug 2027, from 17 Oct 2026, 6 conversions, 0.5% fee, 2% target",
    );
  });
  it("one conversion, a fee of 0 and no float noise", () => {
    expect(
      planInWords(
        state("c=JPY&a=500000.5&s=2026-10-17&d=2027-03-01&k=1&sp=0&t=0.1"),
      ),
    ).toBe(
      "JPY 500,000.5 by 1 Mar 2027, from 17 Oct 2026, 1 conversion, 0% fee, 0.1% target",
    );
  });
});
