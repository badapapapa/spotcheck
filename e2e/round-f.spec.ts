import { expect, test, type Page } from "@playwright/test";

// PR F, from the external QA review:
// F01: a BND plan crashed the page ("RangeError: Invalid array length").
//      Every chart's ticks now treat rounding noise as a flat range, and a
//      chart that fails takes down only its own section.
// F02: huge amounts (and 200% text) pushed the page sideways at 320px.

/** Page errors and console errors while the test runs. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function settled(page: Page) {
  await page
    .getByTestId("results-status")
    .filter({ hasText: /updated/i })
    .waitFor({ state: "attached" });
}

const rangeButton = (page: Page, label: string) =>
  page
    .getByRole("group", { name: "Start dates shown" })
    .getByRole("button", { name: new RegExp(`^${label} \\(`) });

test.describe("F01: the BND peg", () => {
  test("the reported link loads instead of crashing", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/?c=BND&a=10000&s=2026-11-07&d=2029-11-07&k=24&sp=5&t=20");
    await settled(page);
    await expect(
      page.getByRole("slider", { name: "Start of the period" }),
    ).toBeVisible();
    await expect(page.getByTestId("page-error")).toHaveCount(0);
    await expect(page.getByTestId("section-error")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  for (const k of [1, 24])
    for (const sp of [0, 5])
      for (const [plan, d] of [
        ["7-day", "2026-11-14"],
        ["3-year", "2029-11-07"],
      ] as const)
        test(`${k} conversion(s), ${sp}% fee, ${plan} plan, every range`, async ({
          page,
        }) => {
          const errors = watchErrors(page);
          await page.goto(
            `/?c=BND&a=10000&s=2026-11-07&d=${d}&k=${k}&sp=${sp}&t=20`,
          );
          await settled(page);
          const slider = page.getByRole("slider", {
            name: "Start of the period",
          });
          await slider.scrollIntoViewIfNeeded();
          for (const range of ["1Y", "5Y", "10Y", "All"]) {
            await rangeButton(page, range).click();
            await expect(rangeButton(page, range)).toHaveAttribute(
              "aria-pressed",
              "true",
            );
            // A sensible axis: a few finite, distinct tick labels.
            const ticks = await slider
              .locator("svg > g > text")
              .allTextContents();
            expect(ticks.length).toBeGreaterThanOrEqual(1);
            expect(ticks.length).toBeLessThanOrEqual(10);
            expect(new Set(ticks).size).toBe(ticks.length);
            for (const t of ticks) expect(t).toMatch(/^S\$[\d,]+(\.\d+)?$/);
          }
          // Every chart on the page drew, with no error anywhere.
          await expect(page.getByTestId("page-error")).toHaveCount(0);
          await expect(page.getByTestId("section-error")).toHaveCount(0);
          expect(errors).toEqual([]);
        });

  test("Hedging explains the peg instead of failing", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(
      "/advanced?c=BND&a=10000&s=2026-11-07&d=2029-11-07&k=24&sp=5&t=20",
    );
    await expect(
      page.getByText(/pegged 1:1 to the Singapore dollar/),
    ).toBeVisible();
    await expect(page.getByTestId("page-error")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe("F01: a chart that fails takes down only its own section", () => {
  // Makes the timeline's size observer throw while window.__fault is set,
  // standing in for any chart error. Nothing in the app knows about it.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __fault: boolean };
      w.__fault = true;
      const observe = ResizeObserver.prototype.observe;
      ResizeObserver.prototype.observe = function (target, options) {
        if (w.__fault && (target as HTMLElement).dataset?.testid === "timeline")
          throw new Error("test fault in the timeline");
        return observe.call(this, target, options);
      };
    });
  });
  const fault = (page: Page, on: boolean) =>
    page.evaluate((v) => {
      (window as unknown as { __fault: boolean }).__fault = v;
    }, on);

  test("the converter and the other results stay usable", async ({ page }) => {
    await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2");
    await settled(page);
    const error = page.getByTestId("section-error");
    await expect(error).toHaveCount(1);
    await expect(error).toContainText("SpotCheck couldn't show these charts");
    await expect(page.getByTestId("page-error")).toHaveCount(0);
    // Everything else is still there.
    await expect(page.getByLabel("Amount needed (USD)")).toBeEditable();
    await expect(
      page.getByRole("region", { name: "Comparison at a glance" }),
    ).toContainText("All at once");
    await expect(page.locator("#evidence table").first()).toBeAttached();
  });

  test("Try again renders the same plan again", async ({ page }) => {
    await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2");
    await settled(page);
    const error = page.getByTestId("section-error");
    const tryAgain = error.getByRole("button", { name: "Try again" });
    // Still failing: the same error again, same plan.
    await tryAgain.click();
    await expect(error).toHaveCount(1);
    // Now it works: the same plan, drawn.
    await fault(page, false);
    await tryAgain.click();
    await expect(error).toHaveCount(0);
    await expect(
      page.getByRole("slider", { name: "Start of the period" }),
    ).toBeVisible();
    expect(page.url()).toContain("a=15000");
  });

  test("changing the plan clears the error", async ({ page }) => {
    await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2");
    await settled(page);
    await expect(page.getByTestId("section-error")).toHaveCount(1);
    await fault(page, false);
    await page.getByLabel("Amount needed (USD)").fill("20000");
    await expect(page).toHaveURL(/a=20000/);
    await expect(page.getByTestId("section-error")).toHaveCount(0);
    await expect(
      page.getByRole("slider", { name: "Start of the period" }),
    ).toBeVisible();
  });
});

/**
 * Text-only zoom, as in Firefox's "Zoom text only": every element's
 * computed font size and line height doubled (Chromium has no such
 * setting; page zoom is the same as a narrower screen).
 */
async function zoomText(page: Page) {
  await page.evaluate(() => {
    const els = [...document.querySelectorAll("body, body *")] as HTMLElement[];
    const before = els.map((e) => {
      const cs = getComputedStyle(e);
      return [parseFloat(cs.fontSize), cs.lineHeight] as const;
    });
    els.forEach((e, i) => {
      const [size, lh] = before[i]!;
      e.style.setProperty("font-size", `${size * 2}px`, "important");
      if (lh.endsWith("px"))
        e.style.setProperty(
          "line-height",
          `${parseFloat(lh) * 2}px`,
          "important",
        );
    });
  });
}

test.describe("F02: no sideways scrolling, whatever the amount", () => {
  // One browser setup is enough: the widths are set here.
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "widths set by the test");
  });
  const WIDTHS = [320, 360, 390, 405, 768, 1440];

  // Hedging prices USD only, for a plan it can price, so it is checked with
  // USD and a 9-month plan.
  for (const [path, currency, dates] of [
    ["/", "EUR", "s=2026-11-07&d=2029-11-07"],
    ["/advanced", "USD", "s=2026-10-17&d=2027-08-01"],
  ] as const)
    for (const amount of [1, 15000, 1_000_000, 1_000_000_000_000])
      for (const zoom of [false, true])
        test(`${path} ${currency} ${amount.toLocaleString("en-SG")}${zoom ? ", 200% text" : ""}`, async ({
          page,
        }) => {
          test.setTimeout(60_000);
          await page.setViewportSize({ width: 320, height: 800 });
          await page.goto(
            `${path}?c=${currency}&a=${amount}&${dates}&k=24&sp=5&t=20`,
          );
          await settled(page);
          await page.waitForTimeout(500);
          for (const d of await page.locator("details").all())
            await d.evaluate((el) => el.setAttribute("open", ""));
          if (zoom) await zoomText(page);
          for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: 800 });
            await page.waitForTimeout(250);
            const { scroll, client } = await page.evaluate(() => ({
              scroll: document.documentElement.scrollWidth,
              client: document.documentElement.clientWidth,
            }));
            expect(scroll, `page width at ${width}px`).toBeLessThanOrEqual(
              client,
            );
          }
          if (path === "/" && amount === 1_000_000_000_000) {
            // Full values, not cut short: each glance median reads in full.
            const medians = await page
              .getByRole("region", { name: "Comparison at a glance" })
              .locator("tbody td:nth-child(2)")
              .allTextContents();
            expect(medians).toHaveLength(4);
            for (const m of medians)
              expect(m).toMatch(/^S\$1,\d{3},\d{3},\d{3},\d{3}$/);
          }
        });
});
