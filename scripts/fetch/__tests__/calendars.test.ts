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
});
