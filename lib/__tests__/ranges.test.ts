import { describe, expect, it } from "vitest";
import { replay } from "@/engine/replay.ts";
import { loadUsd } from "@/engine/__tests__/helpers.ts";
import {
  clampTo,
  rangeAvailable,
  RANGES,
  timeTicks,
  visibleRange,
} from "../ranges.ts";

const dates = (from: string, to: string) => {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  while (d <= new Date(`${to}T00:00:00Z`)) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};

describe("visibleRange", () => {
  const all = dates("2010-01-01", "2025-12-30");

  it("All shows every period", () => {
    expect(visibleRange(all, "all")).toEqual({ from: 0, to: all.length - 1 });
  });

  it("counts back from the latest period's start, not today", () => {
    for (const [range, start] of [
      ["1y", "2024-12-30"],
      ["5y", "2020-12-30"],
      ["10y", "2015-12-30"],
    ] as const) {
      const { from, to } = visibleRange(all, range);
      expect(all[from]).toBe(start);
      expect(to).toBe(all.length - 1);
    }
  });

  it("starts at the first period on or after the cutoff when that day has no rate", () => {
    const gappy = ["2023-12-28", "2024-01-02", "2024-06-03", "2025-01-01"];
    expect(visibleRange(gappy, "1y").from).toBe(1);
  });

  it("covers the real USD history's periods", () => {
    const r = replay(
      loadUsd(),
      {
        currency: "USD",
        amount: 15_000,
        startDate: "2026-10-17",
        deadline: "2027-08-01",
        tranches: 6,
        spread: 0.005,
      },
      { targetBelowSpot: 0.02 },
    );
    const one = visibleRange(r.startDates, "1y");
    const five = visibleRange(r.startDates, "5y");
    expect(one.to).toBe(r.startDates.length - 1);
    expect(one.from).toBeGreaterThan(five.from);
    // About 260 business days a year.
    expect(one.to - one.from).toBeGreaterThan(240);
    expect(one.to - one.from).toBeLessThan(270);
  });
});

describe("rangeAvailable", () => {
  it("offers every range on a long history", () => {
    const all = dates("1999-01-04", "2025-12-30");
    for (const r of RANGES) expect(rangeAvailable(all, r.id)).toBe(true);
  });

  it("disables a range as long as the history, or longer", () => {
    const four = dates("2021-12-30", "2025-12-30");
    expect(rangeAvailable(four, "1y")).toBe(true);
    expect(rangeAvailable(four, "5y")).toBe(false);
    expect(rangeAvailable(four, "10y")).toBe(false);
    expect(rangeAvailable(four, "all")).toBe(true);
    expect(rangeAvailable(dates("2024-12-30", "2025-12-30"), "1y")).toBe(false);
  });
});

describe("clampTo", () => {
  it("moves an index to the nearest visible period", () => {
    const v = { from: 10, to: 20 };
    expect(clampTo(3, v)).toBe(10);
    expect(clampTo(15, v)).toBe(15);
    expect(clampTo(25, v)).toBe(20);
  });
});

describe("timeTicks", () => {
  it("over two years: 1 January of each year, thinned to fit", () => {
    const ticks = timeTicks("1999-01-04", "2025-12-30", 1000);
    expect(ticks[0]!.label).toBe("2000");
    expect(ticks.length).toBeLessThanOrEqual(12);
    expect(
      timeTicks("1999-01-04", "2025-12-30", 4000).map((t) => t.label),
    ).toEqual(Array.from({ length: 26 }, (_, i) => String(2000 + i)));
  });

  it("two years or less: month starts, January always among them", () => {
    expect(
      timeTicks("2024-12-30", "2025-12-30", 2000).map((t) => t.label),
    ).toEqual([
      "Jan 2025",
      "Feb 2025",
      "Mar 2025",
      "Apr 2025",
      "May 2025",
      "Jun 2025",
      "Jul 2025",
      "Aug 2025",
      "Sep 2025",
      "Oct 2025",
      "Nov 2025",
      "Dec 2025",
    ]);
    // A phone's plot: about 300px, so every 4th or 6th month.
    const phone = timeTicks("2024-12-30", "2025-12-30", 300).map(
      (t) => t.label,
    );
    expect(phone[0]).toBe("Jan 2025");
    expect(phone.length).toBeLessThanOrEqual(3);
  });

  it("ticks fall inside the dates they label", () => {
    const first = "2024-12-30";
    const last = "2025-12-30";
    for (const t of timeTicks(first, last, 600)) {
      expect(t.day).toBeGreaterThan(Date.parse(first) / 86_400_000);
      expect(t.day).toBeLessThanOrEqual(Date.parse(last) / 86_400_000);
    }
  });
});
