import { describe, expect, it } from "vitest";
import { replay } from "@/engine/replay.ts";
import { loadUsd } from "@/engine/__tests__/helpers.ts";
import { describeReplay } from "../summary.ts";
import { BANNED_IN_UI_TEXT as ADVISORY } from "@/tests/advisory-patterns.ts";

const scenario = {
  currency: "USD",
  amount: 15_000,
  startDate: "2026-10-17",
  deadline: "2027-08-01",
  tranches: 6,
  spread: 0.005,
};

describe("describeReplay", () => {
  const r = replay(loadUsd(), scenario, { targetBelowSpot: 0.02 });
  const text = describeReplay(r, scenario, 0.02).join(" ");

  it("describes the history with real numbers", () => {
    expect(text).toMatch(/overlapping windows starting between 4 Jan 1999/);
    expect(text).toMatch(/S\$\d{2},\d{3}/);
    expect(text).toMatch(/not forecasts/);
  });

  it("shows S$100 and above in whole dollars, smaller amounts with cents", () => {
    for (const m of text.matchAll(/S\$([\d,]+(?:\.\d+)?)/g)) {
      const value = Number(m[1]!.replaceAll(",", ""));
      if (value >= 100)
        expect(m[0], "whole dollars from S$100").not.toMatch(/\./);
      else expect(m[0], "cents below S$100").toMatch(/\.\d\d$/);
    }
  });

  it("never uses advisory wording", () => {
    for (const banned of ADVISORY) expect(text).not.toMatch(banned);
  });

  it("leaves out the tranche comparison when there is only one conversion", () => {
    const one = { ...scenario, tranches: 1 };
    const lines = describeReplay(
      replay(loadUsd(), one, { targetBelowSpot: 0.02 }),
      one,
      0.02,
    );
    expect(lines.join(" ")).not.toMatch(/spreading over/);
  });
});
