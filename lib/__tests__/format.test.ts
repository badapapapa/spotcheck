import { describe, expect, it } from "vitest";
import { formatSgd } from "../format.ts";

describe("formatSgd", () => {
  it("shows whole dollars, including small amounts", () => {
    expect(formatSgd(19_312.4)).toBe("S$19,312");
    expect(formatSgd(84.13)).toBe("S$84");
    expect(formatSgd(0.4)).toBe("S$0");
    expect(formatSgd(-1_064.6)).toBe("−S$1,065");
  });

  it("never shows a negative zero", () => {
    expect(formatSgd(-0.3)).toBe("S$0");
    expect(formatSgd(-0.003, { cents: true })).toBe("S$0.00");
  });

  it("shows cents only when asked", () => {
    expect(formatSgd(0.5, { cents: true })).toBe("S$0.50");
  });
});
