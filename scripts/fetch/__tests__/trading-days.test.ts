import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DATA_DIR } from "../io.ts";
import { FxFileSchema, type FxRow } from "../schemas.ts";
import type { Calendar } from "../calendars.ts";
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

  // Frankfurter's blended ISK per SGD, and the dates the Central Bank of
  // Iceland published (its own feed), as served on 16 Nov 2026.
  const isk = (dates: string[]): Calendar => {
    const sorted = [...dates].sort();
    return { dates: new Set(dates), first: sorted[0]!, last: sorted.at(-1)! };
  };

  it("keeps a real tie on a day the home bank published (ISK 16 Nov 2026)", () => {
    const rows = [
      row("2026-11-13", 95.95),
      row("2026-11-14", 95.96), // Saturday
      row("2026-11-15", 95.96), // Sunday
      row("2026-11-16", 95.95), // Monday: equal to Friday, and published
    ];
    const calendar = isk(["2026-11-12", "2026-11-13", "2026-11-16"]);
    expect(
      tradingObservations(rows, { calendar, since: "2026-11-13" }).map(
        (r) => r[0],
      ),
    ).toEqual(["2026-11-13", "2026-11-16"]);
  });

  it("drops a home-market holiday whatever its value (ISK, Christmas 2025)", () => {
    const rows = [
      row("2025-12-23", 97.54),
      row("2025-12-24", 97.69), // holiday, but it moved
      row("2025-12-25", 97.75), // holiday, moved
      row("2025-12-26", 97.75), // holiday, a repeat
      row("2025-12-29", 97.78),
    ];
    const calendar = isk(["2025-12-22", "2025-12-23", "2025-12-29"]);
    expect(
      tradingObservations(rows, { calendar, since: "2025-12-22" }).map(
        (r) => r[0],
      ),
    ).toEqual(["2025-12-23", "2025-12-29"]);
  });

  it("keeps a day the home bank hasn't published yet, then drops it if it was a holiday", () => {
    const rows = [
      row("2026-11-13", 95.95),
      row("2026-11-16", 95.95),
      row("2026-11-17", 95.9),
    ];
    // The bank is a day behind: Monday can't be judged yet, so it stays.
    const behind = isk(["2026-11-12", "2026-11-13"]);
    expect(
      tradingObservations(rows, { calendar: behind, since: "2026-11-12" }).map(
        (r) => r[0],
      ),
    ).toEqual(["2026-11-13", "2026-11-16", "2026-11-17"]);
    // Later the bank publishes Tuesday but not Monday: Monday was a holiday.
    const later = isk(["2026-11-12", "2026-11-13", "2026-11-17"]);
    expect(
      tradingObservations(rows, { calendar: later, since: "2026-11-12" }).map(
        (r) => r[0],
      ),
    ).toEqual(["2026-11-13", "2026-11-17"]);
  });

  it("leaves committed history and days before the calendar as they are", () => {
    const rows = [
      row("2026-10-01", 1), // before `since`: committed
      row("2026-11-02", 1), // before the calendar's first date
      row("2026-11-03", 1),
    ];
    const calendar = isk(["2026-11-03"]);
    expect(
      tradingObservations(rows, { calendar, since: "2026-11-01" }).map(
        (r) => r[0],
      ),
    ).toEqual(["2026-10-01", "2026-11-02", "2026-11-03"]);
  });

  it("keeps every weekday, ties included, without a calendar (ECB, or no home bank)", () => {
    const rows = [
      row("2024-12-24", 0.74),
      row("2024-12-25", 0.74),
      row("2024-12-26", 0.741),
    ];
    expect(tradingObservations(rows).map((r) => r[0])).toEqual([
      "2024-12-24",
      "2024-12-25",
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
