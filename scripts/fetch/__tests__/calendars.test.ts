import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHomeDates, HOME_PROVIDERS } from "../calendars.ts";

afterEach(() => vi.unstubAllGlobals());

describe("fetchHomeDates", () => {
  it("reads each home bank's published dates, a year per request", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/v2/providers"))
          return new Response(
            JSON.stringify([
              { key: "SBI", publishes_missed: 0 },
              { key: "BCCH", publishes_missed: 2 },
            ]),
          );
        urls.push(url);
        const year = url.match(/from=(\d{4})/)![1]!;
        return new Response(
          JSON.stringify([
            { date: `${year}-12-30`, base: "ISK", quote: "USD", rate: 0.008 },
            { date: `${year}-12-31`, base: "ISK", quote: "USD", rate: 0.008 },
          ]),
        );
      }),
    );
    vi.useFakeTimers();
    const pending = fetchHomeDates(
      ["ISK", "CLP", "USD"],
      "2025-12-20",
      "2026-01-05",
    );
    await vi.runAllTimersAsync();
    const cal = await pending;
    vi.useRealTimers();
    // USD has no home bank here (it's an ECB currency), and CLP's bank is
    // reported as having missed publications: both left out.
    expect([...cal.keys()]).toEqual(["ISK"]);
    expect(urls).toEqual([
      "https://api.frankfurter.dev/v2/providers/sbi/rates?base=isk&quotes=usd&from=2025-12-20&to=2025-12-31",
      "https://api.frankfurter.dev/v2/providers/sbi/rates?base=isk&quotes=usd&from=2026-01-01&to=2026-01-05",
    ]);
    expect(cal.get("ISK")!.first).toBe("2025-12-30");
    expect(cal.get("ISK")!.dates.has("2026-12-31")).toBe(true);
  });

  it("only uses banks whose dates are trading days (not BANREP, CBR or BCRA)", () => {
    expect(HOME_PROVIDERS.COP).toBeUndefined();
    expect(HOME_PROVIDERS.RUB).toBeUndefined();
    expect(HOME_PROVIDERS.ARS).toBeUndefined();
    expect(HOME_PROVIDERS.ISK).toBe("sbi");
  });

  /** Runs fetchHomeDates with `respond` as the API, past every retry wait. */
  async function run(respond: (url: string) => Response) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => respond(url)),
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.useFakeTimers();
    const logs: string[] = [];
    const pending = fetchHomeDates(
      ["CLP", "ISK"],
      "2026-11-01",
      "2026-11-16",
      (m) => logs.push(m),
    );
    await vi.runAllTimersAsync();
    const cal = await pending;
    vi.useRealTimers();
    return { cal, logs };
  }
  const providers = () =>
    new Response(
      JSON.stringify([
        { key: "BCCH", publishes_missed: 0 },
        { key: "SBI", publishes_missed: 0 },
      ]),
    );
  const dates = () =>
    new Response(
      JSON.stringify([
        { date: "2026-11-13", base: "X", quote: "USD", rate: 1 },
        { date: "2026-11-16", base: "X", quote: "USD", rate: 1 },
      ]),
    );

  it("a failed providers list (after retries) leaves every bank out and says so", async () => {
    const { cal, logs } = await run(
      () => new Response("down", { status: 503 }),
    );
    expect(cal.size).toBe(0);
    expect(logs).toEqual([
      expect.stringMatching(
        /providers list unavailable .*HTTP 503.*kept provisionally/,
      ),
    ]);
  });

  it("a bank whose dates fail (after retries) is left out; the others are used", async () => {
    const { cal, logs } = await run((url) =>
      url.endsWith("/v2/providers")
        ? providers()
        : url.includes("/sbi/")
          ? new Response("down", { status: 502 })
          : dates(),
    );
    expect([...cal.keys()]).toEqual(["CLP"]);
    expect(logs).toEqual([
      expect.stringMatching(
        /SBI dates unavailable .*HTTP 502.*ISK rows kept provisionally/,
      ),
    ]);
  });
});
