// data/quality.json and the footer's line about it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QualityFileSchema, type QualityFlag } from "@/lib/quality";
import { qualityNote } from "@/lib/quality-note";
import {
  BANNED_IN_UI_TEXT,
  comparesStrategies,
  namesRanking,
} from "./advisory-patterns.ts";

const flag = (currency: string, date: string): QualityFlag => ({
  currency,
  date,
  kind: "move",
  severity: "soft",
  move: -0.095,
  z: -20.8,
  peerZ: -22.8,
  score: null,
});

describe("qualityNote", () => {
  it("says the checks passed, or names each rate under review", () => {
    expect(qualityNote({ checkedThrough: "2026-11-13", open: [] })).toBe(
      "Data checks passed",
    );
    expect(
      qualityNote({
        checkedThrough: "2026-11-13",
        open: [flag("BRL", "2026-10-26")],
      }),
    ).toBe("1 recent rate under review: BRL, 26 Oct 2026");
    expect(
      qualityNote({
        checkedThrough: "2026-11-13",
        open: [flag("KZT", "2026-11-03"), flag("BRL", "2026-10-26")],
      }),
    ).toBe("2 recent rates under review: BRL, 26 Oct 2026; KZT, 3 Nov 2026");
  });

  it("uses no advice wording", () => {
    for (const text of [
      qualityNote({ checkedThrough: "2026-11-13", open: [] }),
      qualityNote({
        checkedThrough: "2026-11-13",
        open: [flag("BRL", "2026-10-26")],
      }),
    ]) {
      for (const banned of BANNED_IN_UI_TEXT) expect(text).not.toMatch(banned);
      expect(namesRanking(text)).toBeUndefined();
      expect(comparesStrategies(text)).toBeUndefined();
    }
  });
});

describe("QualityFileSchema", () => {
  const ok = {
    checkedThrough: "2026-11-13",
    open: [flag("BRL", "2026-10-26")],
  };

  it("accepts the committed file and a well-formed flag", () => {
    QualityFileSchema.parse(
      JSON.parse(readFileSync("data/quality.json", "utf8")),
    );
    expect(QualityFileSchema.parse(ok)).toEqual(ok);
  });

  it("refuses anything else: bad codes, kinds, dates, numbers or extra text", () => {
    const bad = (f: Record<string, unknown>) =>
      QualityFileSchema.safeParse({ ...ok, open: [{ ...ok.open[0], ...f }] })
        .success;
    expect(bad({ currency: "brl" })).toBe(false);
    expect(bad({ currency: "BRL<script>" })).toBe(false);
    expect(bad({ kind: "other" })).toBe(false);
    expect(bad({ date: "26 Oct 2026" })).toBe(false);
    expect(bad({ move: "−9.5%" })).toBe(false);
    expect(bad({ z: Number.NaN })).toBe(false);
    expect(bad({ why: "text" })).toBe(false);
  });
});
