import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readJson } from "../io.ts";
import { assertFormShape, fetchSora } from "../mas.ts";
import {
  runPipeline,
  ValidationError,
  type PipelineDeps,
} from "../pipeline.ts";
import { FxFileSchema, type FxRow } from "../schemas.ts";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const FORM = fixture("mas-form.html");
const CSV = fixture("mas-sora-2020-08.csv");

/** Fakes MAS: GET returns `page`, POST returns `body` with `type`. */
function fakeMas(page: string, body: string, type = "text/csv; charset=utf-8") {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    init?.method === "POST"
      ? new Response(body, { headers: { "content-type": type } })
      : new Response(page, {
          headers: { "content-type": "text/html", "set-cookie": "a=b" },
        }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("MAS fetcher when MAS changes its download form", () => {
  it("works against today's form", async () => {
    vi.stubGlobal("fetch", fakeMas(FORM, CSV));
    const rows = await fetchSora("2020-08-01", "2020-08-31");
    expect(rows).toHaveLength(20);
  });

  it("fails loudly if a checkbox is relabelled (e.g. SORA moves position)", async () => {
    const changed = FORM.replace(">SORA<", ">SORA Index (new)<");
    expect(() => assertFormShape(changed)).toThrow(
      /MAS form has changed.*checkbox 13/,
    );
    vi.stubGlobal("fetch", fakeMas(changed, CSV));
    await expect(fetchSora("2020-08-01", "2020-08-31")).rejects.toThrow(
      /MAS form has changed/,
    );
  });

  it("fails loudly if a form field is renamed", () => {
    const changed = FORM.replaceAll("StartYearDropDownList", "FromYear");
    expect(() => assertFormShape(changed)).toThrow(
      /field StartYearDropDownList missing/,
    );
  });

  it("fails loudly if the download returns a web page instead of CSV", async () => {
    vi.stubGlobal("fetch", fakeMas(FORM, "<html>Error</html>", "text/html"));
    await expect(fetchSora("2020-08-01", "2020-08-31")).rejects.toThrow(
      /instead of CSV/,
    );
  });

  it("fails loudly if the CSV columns change", async () => {
    vi.stubGlobal(
      "fetch",
      fakeMas(FORM, CSV.replace("SORA,Compound", "SORA,Something else")),
    );
    await expect(fetchSora("2020-08-01", "2020-08-31")).rejects.toThrow(
      /unexpected columns/,
    );
  });
});

/** A fake FX source that re-serves committed rows from `from` on. */
const reserve = async (quotes: readonly string[], from: string) =>
  new Map(
    quotes.map((q) => [
      q,
      readJson(`fx/SGD-${q}.json`, FxFileSchema)!.rows.filter(
        (r) => r[0] >= from,
      ),
    ]),
  );

describe("the daily job writes nothing when anything fails", () => {
  /** Real committed data as the starting point; sources return no new rows. */
  function deps(overrides: Partial<PipelineDeps> = {}) {
    const writes: string[] = [];
    const d: PipelineDeps = {
      today: "2026-10-17",
      full: false,
      // Each source re-serves its committed rows from the requested date on.
      fetchFx: reserve,
      fetchEcbCrosses: reserve,
      fetchSora: async () =>
        readJson(
          "rates/SORA.json",
          (await import("../schemas.ts")).SoraFileSchema,
        )!.rows.slice(-10),
      fetchFredSeries: async () =>
        readJson(
          "rates/USD-DFF.json",
          (await import("../schemas.ts")).RateFileSchema,
        )!.rows.slice(-10),
      readJson,
      writeIfChanged: (path) => {
        writes.push(path);
        return false;
      },
      log: () => {},
      ...overrides,
    };
    return { d, writes };
  }

  it("MAS form change: the error propagates and no file is written", async () => {
    const { d, writes } = deps({
      fetchSora: async () => {
        assertFormShape(FORM.replace(">SORA<", ">Renamed<"));
        return [];
      },
    });
    await expect(runPipeline(d)).rejects.toThrow(/MAS form has changed/);
    expect(writes).toEqual([]);
  });

  it("a source returning less than before (e.g. a default date range) is refused, nothing written", async () => {
    const { d, writes } = deps({ fetchSora: async () => [] });
    await expect(runPipeline(d)).rejects.toThrow(ValidationError);
    await expect(runPipeline(d)).rejects.toThrow(/SORA would end on/);
    expect(writes).toEqual([]);
  });

  it("a failed sanity check stops the job before any write", async () => {
    const { d, writes } = deps({
      // USD (an ECB currency) gains a new day with a 10x jump.
      fetchEcbCrosses: async (quotes, from) =>
        new Map(
          quotes.map((q) => {
            const rows = readJson(
              `fx/SGD-${q}.json`,
              FxFileSchema,
            )!.rows.filter((r) => r[0] >= from);
            return [
              q,
              q === "USD" ? [...rows, ["2026-10-19", 0.1, 10] as FxRow] : rows,
            ];
          }),
        ),
    });
    await expect(runPipeline(d)).rejects.toThrow(/Validation failed.*SGD-USD/s);
    expect(writes).toEqual([]);
  });
});
