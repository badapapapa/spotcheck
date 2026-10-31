import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  isWeekend,
  rateAsOf,
  rateOn,
  trancheDates,
} from "@/engine/calendar.ts";
import { trailingCompoundedRate } from "@/engine/rates.ts";
import { realisedVol } from "@/engine/stats.ts";
import type { Series } from "@/engine/types.ts";
import {
  hedgeIssue,
  latestStart,
  maxTranches,
  startDateIssue,
  windowError,
} from "../coverage.ts";

/** Weekday observations from `first` to `last`. */
function weekdays(first: string, last: string, value = 1.3): Series {
  const dates: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1))
    if (!isWeekend(d)) dates.push(d);
  return { dates, values: dates.map(() => value) };
}

const USD = weekdays("1999-01-04", "2026-10-30");
const SORA_FIRST = "2005-07-01";
const SORA = weekdays(SORA_FIRST, "2026-10-29", 0.02);

describe("windowError", () => {
  it("allows exactly three years across a leap year (1,096 days)", () => {
    expect(daysBetween("2026-10-31", "2029-10-31")).toBe(1096);
    expect(windowError("2026-10-31", "2029-10-31")).toBeUndefined();
    expect(windowError("2026-10-31", "2029-11-01")).toMatch(/3 years/);
  });
  it("needs at least a week", () => {
    expect(windowError("2026-10-31", "2026-11-06")).toMatch(/a week/);
    expect(windowError("2026-10-31", "2026-11-07")).toBeUndefined();
  });
});

describe("startDateIssue", () => {
  const TODAY = "2026-10-31";
  it("names the first date of the currency's data", () => {
    expect(startDateIssue("1999-01-01", USD, "USD", TODAY)?.message).toBe(
      "USD data starts 4 Jan 1999. Pick a start on or after that date.",
    );
    expect(startDateIssue("1999-01-04", USD, "USD", TODAY)).toBeUndefined();
    const cny = weekdays("2000-01-13", "2026-10-30");
    expect(startDateIssue("1999-06-01", cny, "CNY", TODAY)?.message).toMatch(
      /^CNY data starts 13 Jan 2000/,
    );
  });
  it("caps far-future starts at a year from today", () => {
    expect(latestStart(TODAY)).toBe("2027-10-31");
    expect(startDateIssue("2027-10-31", USD, "USD", TODAY)).toBeUndefined();
    const far = startDateIssue("2060-01-03", USD, "USD", TODAY);
    expect(far?.message).toMatch(/within a year/);
    expect(far?.suggestedStart).toBe(TODAY);
    expect(
      startDateIssue("1999-01-01", USD, "USD", TODAY)?.suggestedStart,
    ).toBe("1999-01-04");
  });
  it("passes only dates the engine can look up", () => {
    // Whenever startDateIssue passes, rateAsOf (which used to throw during
    // render) has a rate.
    for (const s of ["1999-01-04", "1999-01-09", "2026-10-31", "2027-06-01"])
      if (!startDateIssue(s, USD, "USD", TODAY))
        expect(() => rateAsOf(USD, s)).not.toThrow();
  });
});

describe("hedgeIssue", () => {
  it("explains the SORA look-back and suggests a start that prices", () => {
    const issue = hedgeIssue(USD, SORA_FIRST, "2006-01-01", "2006-08-01", 250);
    expect(issue?.message).toMatch(
      /\(SORA\) begin on 1 Jul 2005\. Pick a start on or after/,
    );
    // The suggested start really prices: the engine's own look-ups succeed.
    const s = issue!.earliestStart!;
    const deadline = addDays(s, daysBetween("2006-01-01", "2006-08-01"));
    expect(hedgeIssue(USD, SORA_FIRST, s, deadline, 250)).toBeUndefined();
    const p = rateAsOf(USD, s).date;
    expect(() =>
      trailingCompoundedRate(SORA, p, daysBetween(p, deadline)),
    ).not.toThrow();
    expect(() => realisedVol(USD, p, 250)).not.toThrow();
  });
  it("accepts a plan Hedging can price", () => {
    expect(
      hedgeIssue(USD, SORA_FIRST, "2026-10-31", "2027-08-01", 250),
    ).toBeUndefined();
  });
  it("refuses forwards of more than 3 years from the latest rates", () => {
    expect(
      hedgeIssue(USD, SORA_FIRST, "2027-10-01", "2030-06-01", 250)?.message,
    ).toMatch(
      /^Hedging prices from the latest rates \(30 Oct 2026\), so keep the deadline within 3 years/,
    );
  });
  it("catches the planner-to-Hedging path that used to crash", () => {
    // The planner works from 5 Jan 2004; Hedging needs SORA from 2005.
    expect(
      hedgeIssue(USD, SORA_FIRST, "2004-01-05", "2004-11-01", 250),
    ).toBeDefined();
  });
});

describe("maxTranches", () => {
  it("keeps conversions at least 3 days apart, at most 24", () => {
    expect(maxTranches("2026-10-31", "2026-11-14")).toBe(5);
    expect(maxTranches("2026-10-31", "2026-11-07")).toBe(3);
    expect(maxTranches("2026-10-31", "2027-08-01")).toBe(24);
  });
  it("never lands two conversions on the same trading day", () => {
    // Every start weekday, every plan length from 1 to 10 weeks.
    for (
      let start = "2026-11-02";
      start < "2026-11-09";
      start = addDays(start, 1)
    )
      for (let days = 7; days <= 70; days++) {
        const deadline = addDays(start, days);
        const k = maxTranches(start, deadline);
        const fx = weekdays(start, addDays(deadline, 7));
        const dates = trancheDates(start, deadline, k).map(
          (d) => rateOn(fx, d).date,
        );
        expect(new Set(dates).size, `${start} +${days}d, k=${k}`).toBe(k);
      }
  });
});
