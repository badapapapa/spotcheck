import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findCurrency } from "../../../engine/currencies.ts";
import { DATA_DIR, stringifyDataFile } from "../io.ts";
import { KNOWN_ANOMALIES } from "../known-anomalies.ts";
import {
  FxFileSchema,
  checkFx,
  checkRate,
  checkSora,
  dropUpstreamErrors,
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

  it("rejects a gap longer than 7 days, warns on 6 to 7, accepts 5 (a long weekend)", () => {
    expect(
      checkFx(
        fx([
          ["2024-01-01", 1.33],
          ["2024-01-09", 1.34],
        ]),
      ).errors[0],
    ).toMatch(/8-day gap/);
    const six = checkFx(
      fx([
        ["2024-01-02", 1.33],
        ["2024-01-08", 1.34],
      ]),
    );
    expect(six.errors).toEqual([]);
    expect(six.warnings[0]).toMatch(/6-day gap/);
    // Thursday before Good Friday to the Tuesday after Easter Monday.
    const easter = checkFx(
      fx([
        ["2024-03-28", 1.33],
        ["2024-04-02", 1.34],
      ]),
    );
    expect(easter.warnings).toEqual([]);
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

  it("rejects weekend rows and carried-forward repeats", () => {
    const weekend = fx([
      ["2024-01-05", 1.33],
      ["2024-01-06", 1.34],
    ]);
    expect(checkFx(weekend).errors[0]).toMatch(/weekend row on 2024-01-06/);
    const repeat = fx([
      ["2024-01-08", 1.33],
      ["2024-01-09", 1.33],
    ]);
    expect(checkFx(repeat).errors[0]).toMatch(/repeats the previous rate/);
    // A pegged series repeats by design.
    expect(checkFx(repeat, [], { allowRepeats: true }).errors).toEqual([]);
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
    // USD comes from the ECB, where an equal consecutive fixing is real.
    expect(findCurrency("USD")?.fxSource).toBe("ecb");
    expect(checkFx(committed, [], { allowRepeats: true }).errors).toEqual([]);
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

describe("upstream errors (known-anomalies)", () => {
  const ERROR = {
    series: "SGD-USD",
    date: "2024-01-02",
    kind: "upstream-error" as const,
    note: "test",
  };
  const rows = fx([
    ["2024-01-01", 1.33],
    ["2024-01-02", 1.6],
    ["2024-01-03", 1.34],
  ]).rows;

  it("drops the listed day and nothing else", () => {
    expect(
      dropUpstreamErrors("SGD-USD", rows, [ERROR]).map((r) => r[0]),
    ).toEqual(["2024-01-01", "2024-01-03"]);
    expect(dropUpstreamErrors("SGD-EUR", rows, [ERROR])).toBe(rows);
  });

  it("fails the checks if the day ever comes back", () => {
    expect(checkFx({ ...fx([]), rows }, [ERROR]).errors).toContain(
      "SGD-USD: 2024-01-02 is a known upstream error and should have been dropped",
    );
  });

  it("SGD-BRL no longer has the ECB's 11 Feb 2000 spike", () => {
    const brl = FxFileSchema.parse(
      JSON.parse(readFileSync(join(DATA_DIR, "fx", "SGD-BRL.json"), "utf8")),
    );
    const at = (d: string) => brl.rows.find((r) => r[0] === d);
    expect(at("2000-02-11")).toBeUndefined();
    // 10 Feb to 14 Feb moves by well under 1%, as Brazil's own rate did.
    expect(
      Math.abs(at("2000-02-14")![2] / at("2000-02-10")![2] - 1),
    ).toBeLessThan(0.01);
    expect(
      KNOWN_ANOMALIES.some(
        (a) =>
          a.series === "SGD-BRL" &&
          a.date === "2000-02-11" &&
          a.kind === "upstream-error",
      ),
    ).toBe(true);
    expect(
      checkFx(brl, KNOWN_ANOMALIES, { allowRepeats: true }).errors,
    ).toEqual([]);
  });
});
