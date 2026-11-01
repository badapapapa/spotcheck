import { describe, expect, it } from "vitest";
import {
  convertWhen,
  fixingLabel,
  lumpSumSentence,
  pastDeadlineNote,
  rateLine,
  rescaledTo,
  spotWhen,
  startContext,
} from "../start-context.ts";

const TODAY = "2026-10-31";
const LAST = "2026-10-30";

describe("startContext", () => {
  it("is 'latest' only when the plan starts on the newest rate", () => {
    expect(startContext(TODAY, LAST, LAST, TODAY).kind).toBe("latest");
    expect(startContext("2025-01-02", "2025-01-02", LAST, TODAY).kind).toBe(
      "past",
    );
    expect(startContext("2027-03-01", LAST, LAST, TODAY).kind).toBe("future");
  });

  it("never says 'today' or 'latest' for a past start", () => {
    const c = startContext("2025-01-02", "2025-01-02", LAST, TODAY);
    const text = [
      convertWhen(c),
      rescaledTo(c),
      rateLine(c, "1.3653", "USD"),
      lumpSumSentence(c, "S$20,582"),
      spotWhen(c),
      fixingLabel(c),
    ].join(" ");
    expect(text).not.toMatch(/today|latest/i);
    expect(convertWhen(c)).toBe("on 2 Jan 2025");
    expect(rateLine(c, "1.3653", "USD")).toBe(
      "Mid rate on 2 Jan 2025: 1.3653 SGD per USD.",
    );
    expect(lumpSumSentence(c, "S$20,582")).toBe(
      "All at once: S$20,582 at the mid rate on 2 Jan 2025 plus your exchange fee, known on that day, so it has no range.",
    );
  });

  it("says a future start uses the latest rate, not 'known today'", () => {
    const c = startContext("2027-03-01", LAST, LAST, TODAY);
    expect(convertWhen(c)).toBe("at the latest rate");
    expect(lumpSumSentence(c, "S$19,000")).not.toMatch(/known today/);
    expect(lumpSumSentence(c, "S$19,000")).toMatch(
      /1 Mar 2027 isn't known yet/,
    );
  });

  it("keeps the wording for a plan starting today", () => {
    const c = startContext(TODAY, LAST, LAST, TODAY);
    expect(convertWhen(c)).toBe("today");
    expect(rateLine(c, "1.2784", "USD")).toBe(
      "Latest mid rate: 1.2784 SGD per USD (30 Oct 2026).",
    );
    expect(lumpSumSentence(c, "S$19,321")).toMatch(/known today/);
  });

  it("names the weekday rate used for a weekend start", () => {
    const c = startContext("2025-01-04", "2025-01-03", LAST, TODAY);
    expect(rateLine(c, "1.3653", "USD")).toBe(
      "Mid rate for 4 Jan 2025: 1.3653 SGD per USD (the last rate before it, 3 Jan 2025).",
    );
  });
});

describe("pastDeadlineNote", () => {
  it("appears only once the deadline has passed", () => {
    expect(pastDeadlineNote("2025-08-01", TODAY)).toMatch(
      /^Your deadline, 1 Aug 2025, has passed/,
    );
    expect(pastDeadlineNote(TODAY, TODAY)).toBeUndefined();
    expect(pastDeadlineNote("2027-08-01", TODAY)).toBeUndefined();
  });
});
