import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CURRENCIES, fxFileName } from "../../../engine/currencies.ts";
import { ECB_SOURCE, ecbCross, fetchEcbCrosses } from "../ecb.ts";
import { DATA_DIR } from "../io.ts";
import { FxFileSchema, MetaFileSchema } from "../schemas.ts";
import { FX_SOURCES } from "../sources.ts";
import { checkAll } from "../validate.ts";

afterEach(() => vi.unstubAllGlobals());

describe("ecbCross", () => {
  it("derives SGD per unit as (SGD per EUR) / (X per EUR)", () => {
    // 1.4395 SGD per EUR, 1.1253 USD per EUR → 1.27921 SGD per USD.
    const [date, usdPerSgd, sgdPerUsd] = ecbCross("2026-10-16", 1.4395, 1.1253);
    expect(date).toBe("2026-10-16");
    expect(sgdPerUsd).toBeCloseTo(1.4395 / 1.1253, 7);
    expect(usdPerSgd * sgdPerUsd).toBeCloseTo(1, 7);
  });

  it("EUR itself is the SGD rate", () => {
    expect(ecbCross("2026-10-16", 1.4395, 1)[2]).toBe(1.4395);
  });

  it("rejects missing or non-positive rates", () => {
    expect(() => ecbCross("2026-10-16", 0, 1.1)).toThrow();
  });
});

describe("fetchEcbCrosses", () => {
  it("pairs each currency with SGD on the same fixing day and skips days without SGD", async () => {
    const rows = [
      { date: "2026-10-15", base: "EUR", quote: "SGD", rate: 1.44 },
      { date: "2026-10-15", base: "EUR", quote: "USD", rate: 1.125 },
      { date: "2026-10-16", base: "EUR", quote: "USD", rate: 1.13 }, // no SGD
    ];
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(rows));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchEcbCrosses(
      ["USD", "EUR"],
      "2026-10-15",
      "2026-10-16",
    );
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      "/v2/providers/ecb/rates?base=eur&quotes=sgd,usd",
    );
    expect(out.get("USD")).toEqual([ecbCross("2026-10-15", 1.44, 1.125)]);
    expect(out.get("EUR")).toEqual([ecbCross("2026-10-15", 1.44, 1)]);
  });
});

describe("one source per currency", () => {
  it("ECB for the 27 currencies it has published continuously since 13 Jan 2000 or earlier, blended for the rest", () => {
    const by = (s: string) =>
      CURRENCIES.filter((c) => c.fxSource === s)
        .map((c) => c.code)
        .sort();
    expect(by("ecb")).toEqual([
      "AUD",
      "BRL",
      "CAD",
      "CHF",
      "CNY",
      "CZK",
      "DKK",
      "EUR",
      "GBP",
      "HKD",
      "HUF",
      "IDR",
      "ILS",
      "INR",
      "JPY",
      "KRW",
      "MXN",
      "MYR",
      "NOK",
      "NZD",
      "PHP",
      "PLN",
      "SEK",
      "THB",
      "TRY",
      "USD",
      "ZAR",
    ]);
    // ISK: gap 2008–2018. ARS, MAD, TWD, RUB: ECB stopped part-way.
    // CLP, COP, KZT, MOP, PEN, SAR, VND: never published by the ECB.
    expect(by("blended")).toEqual([
      "ARS",
      "CLP",
      "COP",
      "ISK",
      "KZT",
      "MAD",
      "MOP",
      "PEN",
      "RUB",
      "SAR",
      "TWD",
      "VND",
    ]);
    expect(by("peg")).toEqual(["BND"]);
  });

  it("ECB currencies added from 13 Jan 2000 start there; the rest start 4 Jan 1999", () => {
    for (const c of CURRENCIES.filter((x) => x.fxSource === "ecb")) {
      const file = FxFileSchema.parse(
        JSON.parse(readFileSync(join(DATA_DIR, fxFileName(c.code)), "utf8")),
      );
      const expected = ["BRL", "CNY", "ILS", "INR"].includes(c.code)
        ? "2000-01-13"
        : "1999-01-04";
      expect(file.rows[0]![0], c.code).toBe(expected);
    }
  });

  it("every committed FX file comes entirely from its configured source", () => {
    for (const c of CURRENCIES) {
      const file = FxFileSchema.parse(
        JSON.parse(readFileSync(join(DATA_DIR, fxFileName(c.code)), "utf8")),
      );
      expect(file.source, c.code).toBe(FX_SOURCES[c.fxSource]);
    }
  });

  it("validation rejects a file whose source doesn't match the configuration", () => {
    const usd = FxFileSchema.parse(
      JSON.parse(readFileSync(join(DATA_DIR, "fx/SGD-USD.json"), "utf8")),
    );
    const fx = new Map(
      CURRENCIES.map((c) => [
        c.code,
        FxFileSchema.parse(
          JSON.parse(readFileSync(join(DATA_DIR, fxFileName(c.code)), "utf8")),
        ),
      ]),
    );
    fx.set("USD", { ...usd, source: FX_SOURCES.blended });
    const { errors } = checkAll({ fx, sora: undefined, rates: new Map() });
    expect(errors).toContain(
      "SGD-USD: source doesn't match engine/currencies.ts (ecb)",
    );
  });

  it("the attribution says SGD crosses are derived from ECB EUR reference rates", () => {
    expect(ECB_SOURCE).toMatch(
      /SGD crosses derived .* \(SGD per EUR\) \/ \(currency per EUR\)/,
    );
    const meta = MetaFileSchema.parse(
      JSON.parse(readFileSync(join(DATA_DIR, "meta.json"), "utf8")),
    );
    expect(meta.attribution[0]!.name).toMatch(
      /European Central Bank.*SGD crosses derived via EUR/,
    );
  });
});
