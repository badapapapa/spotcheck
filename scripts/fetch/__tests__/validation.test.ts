import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DATA_DIR, stringifyDataFile } from "../io.ts";
import {
  FxFileSchema,
  checkFx,
  checkRate,
  checkSora,
  type FxFile,
  type RateFile,
  type SoraFile,
} from "../schemas.ts";

function fx(rows: [string, number][]): FxFile {
  return {
    kind: "fx",
    quote: "USD",
    unit: "SGD per 1 USD",
    source: "test",
    rows: rows.map(([d, sgd]) => [d, 1 / sgd, sgd]),
  };
}

describe("sanity checks", () => {
  const good = fx([
    ["2024-01-01", 1.33],
    ["2024-01-02", 1.34],
    ["2024-01-05", 1.35],
  ]);

  it("accepts clean data", () => {
    expect(checkFx(good).errors).toEqual([]);
  });

  it("rejects dates that are not strictly ascending", () => {
    const bad = fx([
      ["2024-01-02", 1.33],
      ["2024-01-02", 1.34],
    ]);
    expect(checkFx(bad).errors[0]).toMatch(/not strictly ascending/);
  });

  it("rejects a gap longer than 7 days, warns on 5 to 7", () => {
    expect(
      checkFx(
        fx([
          ["2024-01-01", 1.33],
          ["2024-01-09", 1.33],
        ]),
      ).errors[0],
    ).toMatch(/8-day gap/);
    const r = checkFx(
      fx([
        ["2024-01-01", 1.33],
        ["2024-01-06", 1.33],
      ]),
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/5-day gap/);
  });

  it("rejects a day-on-day FX move over 30% unless reviewed", () => {
    const jump = fx([
      ["2024-01-01", 1.33],
      ["2024-01-02", 2.0],
    ]);
    expect(checkFx(jump).errors[0]).toMatch(/50\.4% move/);
    const allow = [
      {
        series: "SGD-USD",
        date: "2024-01-02",
        kind: "jump" as const,
        note: "test",
      },
    ];
    expect(checkFx(jump, allow).errors).toEqual([]);
  });

  it("rejects a stored inversion that doesn't match the raw rate", () => {
    const bad = structuredClone(good);
    bad.rows[1]![2] = 1.5;
    expect(checkFx(bad).errors[0]).toMatch(/inversion mismatch/);
  });

  it("rejects interest rates outside -1% to 25%", () => {
    const rate: RateFile = {
      kind: "rate",
      series: "USD-DFF",
      unit: "",
      source: "",
      rows: [
        ["2024-01-01", 0.05],
        ["2024-01-02", 5.33],
      ], // percent, not decimal
    };
    expect(checkRate(rate).errors[0]).toMatch(/outside/);
    const sora: SoraFile = {
      kind: "sora",
      unit: "",
      source: "",
      rows: [["2024-01-02", "2024-01-03", 0.03, null, -0.02, null]],
    };
    expect(checkSora(sora).errors[0]).toMatch(/outside/);
  });
});

describe("committed data", () => {
  const path = join(DATA_DIR, "fx", "SGD-USD.json");
  const committed = FxFileSchema.parse(JSON.parse(readFileSync(path, "utf8")));

  it("SGD-USD passes every check", () => {
    expect(checkFx(committed).errors).toEqual([]);
  });

  it("a deliberately corrupted copy is rejected (Gate 1)", () => {
    const corrupted = structuredClone(committed);
    const i = Math.floor(corrupted.rows.length / 2);
    // Swap two rows (out of order) and zero a rate.
    [corrupted.rows[i], corrupted.rows[i + 1]] = [
      corrupted.rows[i + 1]!,
      corrupted.rows[i]!,
    ];
    expect(checkFx(corrupted).errors.length).toBeGreaterThan(0);
    const zeroed = JSON.parse(readFileSync(path, "utf8"));
    zeroed.rows[i][2] = 0;
    expect(FxFileSchema.safeParse(zeroed).success).toBe(false);
  });

  it("is written one row per line and round-trips", () => {
    const text = stringifyDataFile(committed);
    expect(text).toBe(readFileSync(path, "utf8"));
    expect(FxFileSchema.parse(JSON.parse(text))).toEqual(committed);
  });
});
