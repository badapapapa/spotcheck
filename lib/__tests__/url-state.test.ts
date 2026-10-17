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
    expect(s.volLookback).toBe(60);
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
});
