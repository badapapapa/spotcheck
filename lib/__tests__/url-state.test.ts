import { describe, expect, it } from "vitest";
import { parseState, serializeState } from "../url-state.ts";
import { defaultDeadline, formatDate, todayInSingapore } from "../dates.ts";

const TODAY = "2026-10-17";

describe("URL state", () => {
  it("uses the plan's defaults when the URL is empty", () => {
    const s = parseState(new URLSearchParams(), TODAY);
    expect(s.scenario).toEqual({
      currency: "USD",
      amount: 15_000,
      startDate: TODAY,
      deadline: "2027-08-01",
      tranches: 6,
      spread: 0.005,
    });
    expect(s.targetBelowSpot).toBe(0.02);
    expect(s.strikePct).toBe(1);
    expect(s.volOverride).toBeUndefined();
    expect(s.volLookback).toBe(250);
  });

  it("round-trips every field through the query string", () => {
    const params = new URLSearchParams(
      "c=EUR&a=8000&s=2026-11-01&d=2027-06-15&k=4&sp=0.75&t=3.5&ks=95&v=12&vl=90",
    );
    const state = parseState(params, TODAY);
    expect(state.scenario.spread).toBeCloseTo(0.0075, 12);
    const again = parseState(serializeState(state), TODAY);
    expect(again).toEqual(state);
    expect(serializeState(state).toString()).toBe(params.toString());
  });

  it("accepts 60, 90 and 250-day volatility lookbacks, defaulting to 250", () => {
    for (const n of [60, 90, 250]) {
      expect(
        parseState(new URLSearchParams(`vl=${n}`), TODAY).volLookback,
      ).toBe(n);
    }
    expect(parseState(new URLSearchParams("vl=7"), TODAY).volLookback).toBe(
      250,
    );
    expect(
      serializeState(parseState(new URLSearchParams(), TODAY)).has("vl"),
    ).toBe(false);
  });

  it("falls back per field on bad values instead of failing", () => {
    const s = parseState(
      new URLSearchParams("c=XXX&a=-5&k=99&sp=abc&d=2020-01-01"),
      TODAY,
    );
    expect(s.scenario.currency).toBe("USD");
    expect(s.scenario.amount).toBe(15_000);
    expect(s.scenario.tranches).toBe(6);
    expect(s.scenario.spread).toBe(0.005);
    expect(s.scenario.deadline).toBe(defaultDeadline(TODAY)); // before start → default
  });

  it("rejects windows longer than three years", () => {
    const s = parseState(new URLSearchParams("d=2031-01-01"), TODAY);
    expect(s.scenario.deadline).toBe(defaultDeadline(TODAY));
  });
});

describe("dates", () => {
  it("today in Singapore crosses midnight 8 hours before UTC", () => {
    expect(todayInSingapore(new Date("2026-10-16T16:30:00Z"))).toBe(
      "2026-10-17",
    );
    expect(todayInSingapore(new Date("2026-10-16T15:30:00Z"))).toBe(
      "2026-10-16",
    );
  });

  it("formats without time zones", () => {
    expect(formatDate("2027-08-01")).toBe("1 Aug 2027");
  });

  it("falls back, like the form, for values the form would reject", () => {
    const p = (q: string) => parseState(new URLSearchParams(q), TODAY);
    // Not rounded to a value nobody typed.
    expect(p("k=1.5").scenario.tranches).toBe(6);
    expect(p("ks=95.5").strikePct).toBe(1);
    expect(p("ks=95").strikePct).toBe(0.95);
    // More conversions than a two-week plan has room for.
    expect(p("s=2026-10-31&d=2026-11-14&k=24").scenario.tranches).toBe(5);
    expect(p("s=2026-10-31&d=2026-11-14&k=4").scenario.tranches).toBe(4);
  });

  it("keeps an exact three-year deadline across a leap year", () => {
    const s = parseState(
      new URLSearchParams("s=2026-10-31&d=2029-10-31"),
      TODAY,
    );
    expect(s.scenario.deadline).toBe("2029-10-31");
  });
});
