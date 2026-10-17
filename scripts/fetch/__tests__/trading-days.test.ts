import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DATA_DIR } from "../io.ts";
import { FxFileSchema, type FxRow } from "../schemas.ts";
import { isWeekend, tradingObservations } from "../trading-days.ts";

const row = (date: string, raw: number): FxRow => [date, raw, 1 / raw];

describe("tradingObservations", () => {
  it("drops Saturdays and Sundays", () => {
    // Fri 5 Jan 2024, Sat 6, Sun 7, Mon 8
    const rows = [
      row("2024-01-05", 0.75),
      row("2024-01-06", 0.751),
      row("2024-01-07", 0.752),
      row("2024-01-08", 0.753),
    ];
    expect(tradingObservations(rows).map((r) => r[0])).toEqual([
      "2024-01-05",
      "2024-01-08",
    ]);
  });

  it("drops a weekday that only repeats the previous rate (carried forward)", () => {
    const rows = [
      row("2024-12-24", 0.74),
      row("2024-12-25", 0.74),
      row("2024-12-26", 0.741),
    ];
    expect(tradingObservations(rows).map((r) => r[0])).toEqual([
      "2024-12-24",
      "2024-12-26",
    ]);
  });

  it("isWeekend reads the date without time zones", () => {
    expect(isWeekend("2026-10-17")).toBe(true); // Saturday
    expect(isWeekend("2026-10-16")).toBe(false); // Friday
  });
});

describe("committed FX files contain only trading observations", () => {
  const files = readdirSync(join(DATA_DIR, "fx")).map((name) =>
    FxFileSchema.parse(
      JSON.parse(readFileSync(join(DATA_DIR, "fx", name), "utf8")),
    ),
  );

  it.each(files.map((f) => [f.quote, f] as const))(
    "%s has no weekend rows",
    (_, f) => {
      expect(f.rows.filter((r) => isWeekend(r[0]))).toEqual([]);
    },
  );

  it("major currencies have about 250–262 observations per full year, not ~365", () => {
    for (const code of ["USD", "EUR", "GBP", "JPY", "AUD"]) {
      const f = files.find((x) => x.quote === code)!;
      for (const year of ["2005", "2015", "2025"]) {
        const n = f.rows.filter((r) => r[0].startsWith(year)).length;
        expect(n, `${code} ${year}`).toBeGreaterThanOrEqual(245);
        expect(n, `${code} ${year}`).toBeLessThanOrEqual(262);
      }
    }
  });
});
