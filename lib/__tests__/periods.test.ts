import { describe, expect, it } from "vitest";
import { replay } from "@/engine/replay.ts";
import { loadUsd } from "@/engine/__tests__/helpers.ts";
import { windowCount } from "../periods.ts";

const base = {
  currency: "USD",
  amount: 15_000,
  startDate: "2026-10-17",
  deadline: "2027-08-01",
  tranches: 6,
  spread: 0.005,
};

describe("windowCount", () => {
  it("matches the number of windows the replay tests", () => {
    const fx = loadUsd();
    for (const deadline of ["2027-08-01", "2027-01-15", "2028-06-30"]) {
      const s = { ...base, deadline };
      expect(windowCount(fx, s)).toBe(
        replay(fx, s, { targetBelowSpot: 0.02 }).windows,
      );
    }
  });
});
