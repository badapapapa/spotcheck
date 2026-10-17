import { describe, expect, it } from "vitest";
import { parseFredCsv, parseFredValue } from "../fred.ts";

describe("FRED parsing", () => {
  it("converts percent to decimal", () => {
    expect(parseFredValue("4.33")).toBe(0.0433);
  });

  it("treats '.' and blanks as no observation, not zero", () => {
    expect(parseFredValue(".")).toBeNull();
    expect(parseFredValue("")).toBeNull();
  });

  it("parses the public CSV and drops missing days", () => {
    const csv =
      "observation_date,DFF\n2025-01-01,4.33\n2025-01-02,.\n2025-01-03,4.33\n";
    expect(parseFredCsv(csv)).toEqual([
      ["2025-01-01", 0.0433],
      ["2025-01-03", 0.0433],
    ]);
  });

  it("rejects an unexpected header", () => {
    expect(() => parseFredCsv("DATE,VALUE\n")).toThrow();
  });
});
