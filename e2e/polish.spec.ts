import { expect, test, type Page } from "@playwright/test";
import { STRATEGY_NAMES } from "../tests/advisory-patterns.ts";

// Round D, phases 5 and 6: Hedging and How it works, and the polish fixes.

const Q = "c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2";

/**
 * Scrolls the whole page in steps; at each step a disclaimer (the header's,
 * the summary bar's or the footer's) must be on screen and on top, not
 * hidden under a bar.
 */
async function disclaimerAlwaysInView(page: Page) {
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  const missing: number[] = [];
  for (let y = 0; y <= height; y += 240) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
    const seen = await page.evaluate(() =>
      [
        '[data-testid="header-disclaimer"]',
        '[data-testid="bar-disclaimer"]',
        "footer p",
      ].some((sel) =>
        [...document.querySelectorAll(sel)].some((el) => {
          if (!/not (financial )?advice/i.test(el.textContent ?? ""))
            return false;
          const r = el.getBoundingClientRect();
          if (r.bottom <= 0 || r.top >= window.innerHeight || !r.width)
            return false;
          const hit = document.elementFromPoint(
            r.left + Math.min(r.width, 20) / 2,
            Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1),
          );
          return hit !== null && (el === hit || el.contains(hit));
        }),
      ),
    );
    if (!seen) missing.push(y);
  }
  expect(missing, "scroll positions with no disclaimer in view").toEqual([]);
}

test.describe("the disclaimer stays in view on phones", () => {
  for (const path of [`/?${Q}`, `/advanced?${Q}`, "/how-it-works"])
    test(`portrait: ${path.split("?")[0]}`, async ({ page, isMobile }) => {
      test.skip(!isMobile, "phones");
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await page.waitForTimeout(1500);
      await disclaimerAlwaysInView(page);
    });

  test("the summary bar carries it", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phones");
    await page.goto(`/?${Q}`);
    await page
      .getByRole("heading", { name: /What if you had converted/ })
      .scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByTestId("bar-disclaimer")).toHaveText("Not advice");
  });

  test("landscape: the slim header keeps it", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`/?${Q}`);
    await page.waitForTimeout(1500);
    await disclaimerAlwaysInView(page);
    await ctx.close();
  });
});

test("the period chart's cursor goes with its readout when the period changes", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "touch readout");
  await page.goto(`/?${Q}`);
  const chart = page.getByRole("img", { name: /^SGD per USD from / });
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("rate-readout")).toContainText(/SGD per USD$/);
  // Pick another period on the timeline.
  const timeline = page.getByRole("slider", { name: "Start of the period" });
  await timeline.scrollIntoViewIfNeeded();
  const t = (await timeline.boundingBox())!;
  await page.touchscreen.tap(t.x + t.width * 0.3, t.y + t.height / 2);
  await chart.scrollIntoViewIfNeeded();
  await expect(page.getByTestId("rate-readout")).toHaveText(
    "Tap the chart to read a rate.",
  );
  await expect(chart.locator(".recharts-tooltip-cursor")).toHaveCount(0);
});

test("the timeline marker stays inside the plot", async ({ page }) => {
  await page.goto(`/?${Q}`);
  const timeline = page.getByRole("slider", { name: "Start of the period" });
  await timeline.scrollIntoViewIfNeeded();
  for (const key of ["End", "Home"]) {
    await timeline.focus();
    await page.keyboard.press(key);
    const { top, dots, lineTop, lineBottom, bottom } = await timeline.evaluate(
      (el) => {
        const grid = [...el.querySelectorAll("svg > g > line")].map((l) =>
          Number(l.getAttribute("y1")),
        );
        const marker = el.querySelector('[data-testid="marker"] line')!;
        return {
          top: Math.min(...grid),
          bottom: Math.max(...grid),
          dots: [...el.querySelectorAll('[data-testid="marker"] circle')].map(
            (c) => Number(c.getAttribute("cy")),
          ),
          lineTop: Number(marker.getAttribute("y1")),
          lineBottom: Number(marker.getAttribute("y2")),
        };
      },
    );
    // From the top gridline (or the highest dot) to the bottom one.
    expect(lineTop).toBeCloseTo(Math.min(top, ...dots), 1);
    expect(lineBottom).toBeCloseTo(Math.max(bottom, ...dots), 1);
  }
});

test("Hedging: intro, plain headline, labelled axes, help tips", async ({
  page,
}) => {
  await page.goto(`/advanced?${Q}`);
  const intro = page.getByTestId("hedging-intro");
  for (const term of ["Shows", "You enter", "You get", "Assumes"])
    await expect(intro.locator("dt", { hasText: term })).toBeVisible();
  await expect(page.getByTestId("answer")).toContainText(
    "because of the interest-rate gap",
  );
  await expect(page.getByTestId("carry")).toContainText("not a saving");
  await expect(page.locator("#greeks-title")).toBeVisible();
  await expect(page.getByText("SGD per USD on the deadline")).toBeVisible();
  // The spot ("today", or the start's own date for a past start) is
  // marked on the payoff chart and on all four Greeks.
  await expect(
    page
      .locator("svg text")
      .filter({ hasText: /^(today|latest|\d{1,2} \w{3} \d{4})$/ }),
  ).toHaveCount(5);
  for (const term of [
    "SORA",
    "fed funds",
    "carry",
    "the strike",
    "notional",
    "realised and implied volatility",
  ])
    await expect(
      page.getByRole("button", { name: `About ${term}` }),
    ).toBeVisible();
});

test("How it works: a quick level first, with the timing diagram", async ({
  page,
}) => {
  await page.goto("/how-it-works");
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText(
    "At a glance",
  );
  const diagram = page.getByTestId("timing-diagram");
  await expect(diagram.locator("li > div > p.font-medium")).toHaveText(
    STRATEGY_NAMES,
  );
  await expect(diagram).toContainText("if it never does, on the deadline");
});

test("the 404 page points to the menu, wherever it is", async ({ page }) => {
  await page.goto("/404");
  await expect(page.locator("main")).toContainText("in the site menu");
  await expect(page.locator("main")).not.toContainText("top of the page");
});

for (const path of ["/", "/advanced", "/how-it-works", "/404"])
  test(`320px: no sideways scrolling on ${path}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 320, height: 640 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${path}${path === "/404" ? "" : `?${Q}`}`);
    await page.waitForTimeout(2000);
    for (const d of await page.locator("details").all())
      await d.evaluate((el) => el.setAttribute("open", ""));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await ctx.close();
  });
