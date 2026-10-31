import { describe, expect, it } from "vitest";
import { replay } from "@/engine/replay.ts";
import { loadUsd } from "@/engine/__tests__/helpers.ts";
import { describeReplay } from "../summary.ts";
import {
  BANNED_IN_UI_TEXT as ADVISORY,
  namesRanking,
} from "@/tests/advisory-patterns.ts";
import { addDays } from "@/engine/calendar.ts";
import { loadFx } from "@/engine/__tests__/helpers.ts";

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

  it("never names a strategy as coming top or bottom, in any history", () => {
    for (const [code, days, k] of [
      ["USD", 290, 6],
      ["JPY", 30, 2],
      ["VND", 730, 12],
      ["EUR", 180, 1],
      ["GBP", 400, 4],
    ] as const) {
      const fx = loadFx(code);
      const s = {
        ...scenario,
        currency: code,
        startDate: fx.dates.at(-1)!,
        deadline: addDays(fx.dates.at(-1)!, days),
        tranches: k,
      };
      const lines = describeReplay(
        replay(fx, s, { targetBelowSpot: 0.02 }),
        s,
        0.02,
      ).join(" ");
      expect(namesRanking(lines), code).toBeUndefined();
      for (const banned of ADVISORY) expect(lines).not.toMatch(banned);
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
