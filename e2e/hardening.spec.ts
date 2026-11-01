import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// PR B: accessibility, performance and hardening fixes from the stress
// test. Each test failed on the build before the fix.

const Q = "c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2";
const ready = (page: Page) => expect(page.getByTestId("summary")).toBeVisible();

test.describe("B1: charts are not unnamed focus stops", () => {
  for (const path of [`/?${Q}`, `/advanced?${Q}`])
    test(`no chart takes focus or interrupts on ${path.split("?")[0]}`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.getByTestId("results-status")).toHaveText(
        /results updated/i,
      );
      await page.waitForTimeout(1000);
      const counts = await page.evaluate(() => ({
        app: document.querySelectorAll('[role="application"]').length,
        stops: [...document.querySelectorAll(".recharts-wrapper *")].filter(
          (e) => (e as HTMLElement).tabIndex >= 0,
        ).length,
        assertive: document.querySelectorAll('[aria-live="assertive"]').length,
      }));
      expect(counts).toEqual({ app: 0, stops: 0, assertive: 0 });
    });
});

test.describe("B2: the period chart's tooltip and legend", () => {
  test("legend in the fixed strategy order", async ({ page }) => {
    await page.goto(`/?${Q}`);
    const chart = page.getByRole("img", { name: /^SGD per USD from / });
    await chart.scrollIntoViewIfNeeded();
    const legend = page.locator(".recharts-legend-wrapper li");
    await expect(legend).toHaveText([
      "SGD per USD",
      "All at once",
      "Equal tranches",
      "Wait until deadline",
      "Target rate",
    ]);
  });

  test("a conversion day names the strategy, date and rate", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name === "mobile",
      "hover tooltip (touch has a readout)",
    );
    await page.goto(`/?${Q}`);
    const chart = page.getByRole("img", { name: /^SGD per USD from / });
    await chart.scrollIntoViewIfNeeded();
    // The first conversion of every strategy except waiting is day one.
    const box = (await chart
      .locator(".recharts-cartesian-grid")
      .boundingBox())!;
    await page.mouse.move(box.x + 1, box.y + box.height / 2);
    const tip = page.locator(".recharts-tooltip-wrapper");
    await expect(tip).toContainText(/^\d{1,2} \w{3} \d{4}/);
    await expect(tip).toContainText(/All at once converted at \d\.\d+/);
    await expect(tip).toContainText(/Equal tranches converted at \d\.\d+/);
    // Never a raw day number as a rate (it used to show "20482").
    for (const line of (await tip.innerText()).split("\n"))
      expect(line).not.toMatch(/\b\d{5}\b/);
    // Text in ink, at full contrast; the markers carry the colours.
    const colors = await tip
      .locator("li")
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).color));
    const ink = await page.evaluate(
      () => getComputedStyle(document.body).color,
    );
    for (const c of colors) expect(c).toBe(ink);
  });
});

test.describe("B3: highlighting keeps text readable", () => {
  test("other rows dim their marks, not their text", async ({ page }, info) => {
    test.skip(info.project.name === "mobile", "hover");
    await page.goto(`/?${Q}`);
    await ready(page);
    const glance = page.getByRole("table", { name: /Median historical cost/ });
    await glance.getByRole("button", { name: "Equal tranches" }).hover();
    await page.waitForTimeout(400); // past the 150 ms fade
    const other = glance.locator("tbody tr").nth(0);
    const style = await other.evaluate((tr) => ({
      opacity: getComputedStyle(tr).opacity,
      color: getComputedStyle(tr).color,
      mark: getComputedStyle(tr.querySelector(".mark")!).opacity,
    }));
    // Their text turns --muted, at least 5.7:1 on every surface (DESIGN.md §2).
    const muted = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--muted)";
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    expect(style.opacity).toBe("1");
    expect(style.mark).toBe("0.3");
    expect(style.color).toBe(muted);
  });
});

test.describe("B4: smaller accessibility fixes", () => {
  for (const [w, font] of [
    [320, 16],
    [348, 16],
    [375, 24],
  ] as const)
    test(`no sideways scroll at ${w}px with ${font}px text`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({
        viewport: { width: w, height: 800 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await ctx.newPage();
      await page.goto(`/?${Q}`);
      await ready(page);
      if (font !== 16)
        await page.addStyleTag({
          content: `html, body { font-size: ${font}px !important; }`,
        });
      await page.locator("summary", { hasText: "More options" }).click();
      await page.waitForTimeout(800);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(w);
      await ctx.close();
    });

  test("the date field keeps its focus ring on the calendar button", async ({
    page,
  }, info) => {
    test.skip(info.project.name === "mobile", "keyboard");
    await page.goto(`/?${Q}`);
    await ready(page);
    // The real currency button (it loads just after the page).
    await expect(page.getByLabel(/^Currency you need/)).toBeEnabled();
    await page.getByLabel(/^Currency you need/).focus();
    // Day, month and year, then the calendar button, in every locale.
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    await expect(page.getByLabel("Needed by")).toBeFocused();
    await expect(page.getByLabel("Needed by")).toHaveCSS(
      "outline-style",
      "solid",
    );
  });

  test("Hedging's range rows aren't fake buttons", async ({ page }) => {
    await page.goto(`/advanced?${Q}`);
    await expect(page.getByTestId("results-status")).toHaveText(
      /results updated/i,
    );
    const chart = page.locator(
      '[aria-label^="Range of SGD cost with no hedge"]',
    );
    await expect(chart).toBeVisible();
    await expect(chart.locator('[role="button"], [tabindex="0"]')).toHaveCount(
      0,
    );
  });

  test("new results are announced politely", async ({ page }) => {
    await page.goto(`/?${Q}`);
    await expect(page.getByTestId("results-status")).toHaveText(
      "Results updated for USD 15,000.",
    );
    await expect(page.getByTestId("results-status")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  test("a skip link leads to the content", async ({ page }, info) => {
    test.skip(info.project.name === "mobile", "keyboard");
    await page.goto(`/?${Q}`);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });

  test("each 'More detail' toggle says whose detail it is", async ({
    page,
  }) => {
    await page.goto(`/?${Q}`);
    const names = await page
      .locator("summary", { hasText: "More detail" })
      .allTextContents();
    expect(names).toEqual([
      "More detailLess detail: All at once",
      "More detailLess detail: Equal tranches",
      "More detailLess detail: Wait until deadline",
      "More detailLess detail: Target rate",
    ]);
  });

  test("the phone's Edit bar comes first in the tab order", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "phone bar");
    await page.goto(`/?${Q}`);
    await ready(page);
    await page.getByTestId("summary").scrollIntoViewIfNeeded();
    const edit = page.getByRole("button", { name: "Edit" });
    await expect(edit).toBeVisible();
    const before = await edit.evaluate(
      (e) =>
        !!(
          e.compareDocumentPosition(
            document.querySelector('[aria-label="Your plan"]')!,
          ) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
    );
    expect(before).toBe(true);
  });

  test("the period chart's axis labels don't touch", async ({ page }) => {
    await page.goto(`/?${Q}`);
    const chart = page.getByRole("img", { name: /^SGD per USD from / });
    await chart.scrollIntoViewIfNeeded();
    const yLow = (await chart
      .locator(".recharts-yAxis-tick-labels text")
      .first()
      .boundingBox())!;
    const xs = chart.locator(".recharts-xAxis-tick-labels text");
    const x = (await xs.first().boundingBox())!;
    expect(x.y).toBeGreaterThanOrEqual(yLow.y + yLow.height);
  });

  test("text links have 44px-tall tap areas", async ({ page }) => {
    await page.goto("/how-it-works");
    const back = page.getByRole("link", { name: "Back to the planner" });
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.goto(`/advanced?${Q}`);
    const planner = page.getByRole("link", { name: "planner", exact: true });
    const area = await planner.evaluate((a) => {
      const r = a.getBoundingClientRect();
      const s = getComputedStyle(a, "::after");
      return r.height - parseFloat(s.top) - parseFloat(s.bottom);
    });
    expect(area).toBeGreaterThanOrEqual(40);
  });

  test("a landscape phone keeps room for the timeline", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`/?${Q}`);
    await ready(page);
    await page
      .getByRole("img", { name: /^Cost of each strategy/ })
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    // Scrolled past the converter, where the bar used to appear.
    await expect(page.getByRole("button", { name: "Edit" })).toBeHidden();
    await ctx.close();
  });
});

test.describe("B5: performance", () => {
  test("picking currencies doesn't pile up detached lists", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP counters");
    const cdp = await context.newCDPSession(page);
    await page.goto(`/?${Q}`);
    await ready(page);
    const pick = async (code: string) => {
      await page.getByLabel(/^Currency you need/).click();
      await page.getByPlaceholder("Country, currency or code").fill(code);
      await page
        .getByRole("option", { name: new RegExp(`\\b${code}\\b`) })
        .first()
        .click();
      await page.waitForTimeout(300);
    };
    const nodes = async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      return (await cdp.send("Memory.getDOMCounters")).nodes;
    };
    await pick("EUR");
    await pick("USD");
    const before = await nodes();
    for (let i = 0; i < 4; i++) {
      await pick("EUR");
      await pick("USD");
    }
    // It used to grow by ~318 nodes per pick (~2,500 here).
    expect((await nodes()) - before).toBeLessThan(150);
  });

  test("the build ships no TypeScript source or empty source maps", () => {
    const files = readdirSync(join("out", "_next", "static"), {
      recursive: true,
    }).map(String);
    expect(files.filter((f) => f.endsWith(".ts"))).toEqual([]);
    expect(files.filter((f) => f.endsWith(".map"))).toEqual([]);
  });

  test("hashed assets are cached for a year", async ({ page }) => {
    const res = await page.goto(`/?${Q}`);
    const js = (await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((n) => n.includes("/_next/static/")),
    ))!;
    const asset = await page.request.get(js);
    expect(asset.headers()["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res!.headers()["cache-control"]).toBeUndefined();
  });
});

test.describe("B6: no CSP violations", () => {
  for (const path of [`/?${Q}`, `/advanced?${Q}`])
    test(`no eval probe on ${path.split("?")[0]}`, async ({ page }) => {
      // Chrome reports a blocked eval as an event, not on the console.
      await page.addInitScript(() => {
        const w = window as unknown as { __csp: string[] };
        w.__csp = [];
        document.addEventListener("securitypolicyviolation", (e) =>
          w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
        );
      });
      await page.goto(path);
      await expect(page.getByTestId("results-status")).toHaveText(
        /results updated/i,
      );
      await page.waitForTimeout(1000);
      expect(
        await page.evaluate(
          () => (window as unknown as { __csp: string[] }).__csp,
        ),
      ).toEqual([]);
    });
});
