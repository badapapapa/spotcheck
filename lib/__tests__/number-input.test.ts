import { describe, expect, it } from "vitest";
import {
  MESSAGES,
  formatNumberText,
  parseNumberText,
  readNumberField,
} from "../number-input.ts";

const value = (t: string) => {
  const p = parseNumberText(t);
  return p.ok ? p.value : undefined;
};
const message = (t: string) => {
  const p = parseNumberText(t);
  return p.ok ? undefined : p.message;
};

describe("parseNumberText", () => {
  it("reads plain numbers and English grouping", () => {
    expect(value("15000")).toBe(15000);
    expect(value(" 15000 ")).toBe(15000);
    expect(value("0.5")).toBe(0.5);
    expect(value(".5")).toBe(0.5);
    expect(value("5.")).toBe(5);
    expect(value("0.500")).toBe(0.5);
    expect(value("15,000")).toBe(15000);
    expect(value("1,500,000.50")).toBe(1_500_000.5);
    expect(value("15 000")).toBe(15000);
    expect(value("15 000")).toBe(15000);
  });

  it("never guesses at European forms", () => {
    // Each of these used to become a different number without a word.
    expect(message("15.000")).toBe(MESSAGES.dotThousands);
    expect(message("1.500.000")).toBe(MESSAGES.dotThousands);
    expect(message("1.500,50")).toBe(MESSAGES.mixed);
    expect(message("15,5")).toBe(MESSAGES.decimalComma);
    expect(message("0,5")).toBe(MESSAGES.decimalComma);
    expect(message("15,50")).toBe(MESSAGES.decimalComma);
  });

  it("names the digits it reads", () => {
    expect(message("١٥٠٠٠")).toBe(MESSAGES.otherDigits); // Arabic-Indic
    expect(message("۱۵")).toBe(MESSAGES.otherDigits); // Persian
    expect(message("１５")).toBe(MESSAGES.otherDigits); // full-width
  });

  it("rejects anything else", () => {
    for (const t of [
      "",
      "abc",
      "-5",
      "+5",
      "1e5",
      "1.2.3",
      "15,00,0",
      "15, 000",
      "1,5 000",
      "Infinity",
    ])
      expect(parseNumberText(t).ok, t).toBe(false);
  });
});

describe("readNumberField", () => {
  const vol = { min: 1, max: 100, range: "Enter 1–100%." };
  it("states the range for every out-of-range or unreadable value", () => {
    for (const t of ["0", "-5", "0.5", "101", "250", "abc", ""])
      expect(readNumberField(t, vol)).toEqual({
        ok: false,
        message: vol.range,
      });
    expect(readNumberField("12.5", vol)).toEqual({ ok: true, value: 12.5 });
  });

  it("keeps the specific message for European forms", () => {
    expect(
      readNumberField("0,5", { min: 0, max: 5, range: "Enter 0–5%." }),
    ).toEqual({
      ok: false,
      message: MESSAGES.decimalComma,
    });
  });

  it("checks whole numbers", () => {
    const k = { min: 1, max: 24, integer: true, range: "Enter 1–24." };
    expect(readNumberField("1.5", k).ok).toBe(false);
    expect(readNumberField("6", k)).toEqual({ ok: true, value: 6 });
  });
});

describe("formatNumberText", () => {
  it("groups in threes and drops trailing zeros", () => {
    expect(formatNumberText(15000)).toBe("15,000");
    expect(formatNumberText(0.5)).toBe("0.5");
    expect(formatNumberText(1_000_000_000_000)).toBe("1,000,000,000,000");
  });
});
