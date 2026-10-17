import { describe, expect, it } from "vitest";
import {
  addMonths,
  isWeekend,
  daysBetween,
  rateAsOf,
  rateOn,
  trancheDates,
  yearFraction,
} from "../calendar.ts";
import { weekdays } from "./helpers.ts";

// Fri 5 Jan 2024, Mon 8 Jan, Tue 9 Jan
const fx = weekdays("2024-01-05", [1.31, 1.32, 1.33]);

describe("rate lookups", () => {
  it("rateOn snaps a weekend forward to Monday", () => {
    expect(rateOn(fx, "2024-01-06")).toEqual({
      date: "2024-01-08",
      value: 1.32,
    });
    expect(rateOn(fx, "2024-01-07")).toEqual({
      date: "2024-01-08",
      value: 1.32,
    });
  });

  it("rateAsOf on a weekend uses Friday (never the future)", () => {
    expect(rateAsOf(fx, "2024-01-07")).toEqual({
      date: "2024-01-05",
      value: 1.31,
    });
  });

  it("returns the exact day when it exists", () => {
    expect(rateOn(fx, "2024-01-09").value).toBe(1.33);
    expect(rateAsOf(fx, "2024-01-09").value).toBe(1.33);
  });

  it("a missing deadline rate snaps forward; past the data it throws", () => {
    const holiday = {
      dates: ["2024-01-05", "2024-01-09"],
      values: [1.31, 1.33],
    };
    expect(rateOn(holiday, "2024-01-08").date).toBe("2024-01-09");
    expect(() => rateOn(fx, "2024-01-10")).toThrow();
    expect(() => rateAsOf(fx, "2024-01-04")).toThrow();
  });
});

describe("date arithmetic", () => {
  it("isWeekend knows Saturday and Sunday", () => {
    expect(
      ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19"].map(isWeekend),
    ).toEqual([false, true, true, false]);
    expect(isWeekend("1970-01-01")).toBe(false); // Thursday
    expect(isWeekend("1969-12-28")).toBe(true); // Sunday, before the epoch
  });

  it("counts calendar days across a leap year", () => {
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
    expect(yearFraction("2023-01-01", "2024-01-01")).toBe(1);
  });

  it("addMonths clamps to the end of the month", () => {
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2023-03-31", -1)).toBe("2023-02-28");
    expect(addMonths("2024-11-15", 3)).toBe("2025-02-15");
  });

  it("tranche dates are evenly spaced and include both ends", () => {
    expect(trancheDates("2024-01-01", "2024-01-31", 4)).toEqual([
      "2024-01-01",
      "2024-01-11",
      "2024-01-21",
      "2024-01-31",
    ]);
    expect(trancheDates("2024-01-01", "2024-01-31", 1)).toEqual(["2024-01-01"]);
    expect(() => trancheDates("2024-01-01", "2024-01-31", 0)).toThrow();
  });
});
