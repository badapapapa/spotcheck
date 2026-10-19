import { describe, expect, it } from "vitest";
import { formatSgd } from "../format.ts";

describe("formatSgd", () => {
  it("shows whole dollars from S$100 up", () => {
    expect(formatSgd(19_312.4)).toBe("S$19,312");
    expect(formatSgd(100)).toBe("S$100");
    expect(formatSgd(-1_064.6)).toBe("−S$1,065");
  });

  it("shows cents under S$100", () => {
    expect(formatSgd(84.13)).toBe("S$84.13");
    expect(formatSgd(0.7391)).toBe("S$0.74");
    expect(formatSgd(99.994)).toBe("S$99.99");
    expect(formatSgd(99.996)).toBe("S$100"); // rounds up into whole dollars
  });

  it("never shows a negative zero", () => {
    expect(formatSgd(-0.003)).toBe("S$0.00");
  });

  it("takes explicit decimals for axis ticks", () => {
    expect(formatSgd(0.7, { decimals: 2 })).toBe("S$0.70");
    expect(formatSgd(20_000, { decimals: 0 })).toBe("S$20,000");
  });
});
