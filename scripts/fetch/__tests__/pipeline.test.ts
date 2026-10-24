import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertFormShape, fetchSora } from "../mas.ts";
import {
  runPipeline,
  ValidationError,
  type PipelineDeps,
} from "../pipeline.ts";
import type { RateRow, SoraRow } from "../schemas.ts";
import {
  FAKE_LAST_DAY,
  FAKE_NEXT_DAY,
  FAKE_TODAY,
  fakeFiles,
  fakeReadJson,
  reserveFx,
} from "./fake-store.ts";

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

describe("the daily job writes nothing when anything fails", () => {
  // Hermetic: the "committed" files and the "fetched" data both come from a
  // fixed in-memory fixture (fake-store.ts), never from the real data/
  // folder, so new daily rows can't change what these tests see.
  function deps(overrides: Partial<PipelineDeps> = {}) {
    const files = fakeFiles();
    const writes: string[] = [];
    const sora = (files.get("rates/SORA.json") as { rows: SoraRow[] }).rows;
    const dff = (files.get("rates/USD-DFF.json") as { rows: RateRow[] }).rows;
    const d: PipelineDeps = {
      today: FAKE_TODAY,
      full: false,
      // Each source re-serves the fixture's rows from the requested date on.
      fetchFx: reserveFx(files),
      fetchEcbCrosses: reserveFx(files),
      fetchSora: async (from) => sora.filter((r) => r[0] >= from),
      fetchFredSeries: async (_id, from) => dff.filter((r) => r[0] >= from),
      readJson: fakeReadJson(files),
      writeIfChanged: (path) => {
        writes.push(path);
        return false;
      },
      log: () => {},
      ...overrides,
    };
    return { d, writes, files };
  }

  it("with clean fixture data the job succeeds and writes every file (control)", async () => {
    const { d, writes } = deps();
    await expect(runPipeline(d)).resolves.toEqual({ changed: 0 });
    // 40 FX files, SORA, DFF and meta.json.
    expect(writes).toHaveLength(43);
  });

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
    // The rows kept from before the re-fetch window end earlier than the file.
    await expect(runPipeline(d)).rejects.toThrow(
      new RegExp(
        `SORA would end on 2026-09-\\d\\d, before its committed last date ${FAKE_LAST_DAY}`,
      ),
    );
    expect(writes).toEqual([]);
  });

  it("a failed sanity check stops the job before any write", async () => {
    const { d, writes, files } = deps();
    // USD (an ECB currency) gains a new day, after its last committed day,
    // with a 10x jump: the shrink guard is satisfied, so validation must be
    // what stops the job.
    d.fetchEcbCrosses = async (quotes, from) => {
      const fresh = await reserveFx(files)(quotes, from);
      fresh.get("USD")!.push([FAKE_NEXT_DAY, 0.1, 10]);
      return fresh;
    };
    const error = await runPipeline(d).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as Error).message).toMatch(/^Validation failed/);
    expect((error as Error).message).toMatch(/SGD-USD: .*% move on 2026-10-01/);
    expect((error as Error).message).not.toMatch(
      /shorter than what is committed/,
    );
    expect(writes).toEqual([]);
  });
});
