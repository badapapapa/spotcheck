import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMasCsv } from "../mas.ts";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");

describe("parseMasCsv", () => {
  it("parses value dates, publication dates and percentages as decimals", () => {
    const rows = parseMasCsv(fixture("mas-sora-2020-08.csv"));
    expect(rows).toHaveLength(20);
    expect(rows[0]).toEqual([
      "2020-08-03",
      "2020-08-04",
      0.001313,
      0.000899,
      0.000816,
      0.003054,
    ]);
    // Month and year are blank on later rows and must carry forward.
    expect(rows.at(-1)?.[0]).toBe("2020-08-31");
    expect(rows.at(-1)?.[1]).toBe("2020-09-01");
  });

  it("maps '-' (not yet published) to null, not zero", () => {
    const rows = parseMasCsv(fixture("mas-sora-2005-07.csv"));
    expect(rows[0]).toEqual([
      "2005-07-01",
      "2005-07-04",
      0.017998,
      null,
      null,
      null,
    ]);
  });

  it("fails loudly if MAS changes the columns", () => {
    const csv = fixture("mas-sora-2020-08.csv").replace(
      "SORA,Compound",
      "SORA,Other",
    );
    expect(() => parseMasCsv(csv)).toThrow(/unexpected columns/);
  });
});
