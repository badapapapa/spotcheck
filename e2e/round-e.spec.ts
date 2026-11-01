import { expect, test, type Page } from "@playwright/test";

// Round E: the converter's direction, the timeline's range buttons (display
// only) and the target field's plain label.

const Q = "c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2";

async function pickCurrency(page: Page, search: string, code: string) {
  await page.getByLabel("Currency you need").click();
  await page.getByPlaceholder("Country, currency or code").fill(search);
  await page.getByRole("option", { name: new RegExp(`\\b${code}\\b`) }).click();
}

for (const path of ["/", "/advanced"])
  test(`${path}: the converter says you pay SGD and need the chosen currency`, async ({
    page,
  }) => {
    await page.goto(`${path}?${Q}`);
    const direction = page.getByTestId("direction");
    await expect(direction).toHaveText("You pay SGD, you need USD");
    // Not a control: nothing in it can be pressed or focused.
    await expect(direction.locator("button, a, [tabindex]")).toHaveCount(0);
    await pickCurrency(page, "Japan", "JPY");
    await expect(direction).toHaveText("You pay SGD, you need JPY");
  });

async function openTimeline(page: Page) {
  await page.goto(`/?${Q}`);
  const slider = page.getByRole("slider", { name: "Start of the period" });
  await slider.scrollIntoViewIfNeeded();
  await expect(slider).toBeVisible();
  const ranges = page.getByRole("group", { name: "Range shown on the chart" });
  const attr = async (name: string) => Number(await slider.getAttribute(name));
  return {
    slider,
    ranges,
    button: (label: string) =>
      ranges.getByRole("button", { name: new RegExp(`^${label} \\(`) }),
    now: () => attr("aria-valuenow"),
    min: () => attr("aria-valuemin"),
    max: () => attr("aria-valuemax"),
    yTicks: () =>
      slider
        .locator("svg > g > text")
        .allTextContents()
        .then((t) => t.join(" ")),
    xTicks: () =>
      slider
        .locator("svg > text")
        .allTextContents()
        .then((t) => t.join(" ")),
  };
}

/** Everything on the page except the timeline section, as text. */
const restOfPage = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector("main")!.cloneNode(true) as Element;
    main
      .querySelector('[data-testid="timeline"]')
      ?.closest("section")
      ?.remove();
    // The phone summary bar comes and goes with the scroll position.
    main.querySelector(".summary-bar")?.remove();
    return main.textContent;
  });

test("range buttons: a labelled group, All pressed by default", async ({
  page,
}) => {
  const t = await openTimeline(page);
  await expect(t.ranges.getByRole("button")).toHaveCount(4);
  for (const [label, spoken] of [
    ["1Y", "last year"],
    ["5Y", "last 5 years"],
    ["10Y", "last 10 years"],
    ["All", "every period"],
  ]) {
    const b = t.ranges.getByRole("button", { name: `${label} (${spoken})` });
    await expect(b).toBeEnabled();
    await expect(b).toHaveAttribute(
      "aria-pressed",
      label === "All" ? "true" : "false",
    );
  }
  expect(await t.min()).toBe(0);
  await expect(page.getByTestId("range-note")).toHaveCount(0);
});

test("a range changes the chart only: every result stays the same", async ({
  page,
}) => {
  const t = await openTimeline(page);
  const before = await restOfPage(page);
  const allX = await t.xTicks();
  const allY = await t.yTicks();
  const last = await t.max();
  expect(await t.now()).toBe(last);

  await t.button("1Y").click();
  await expect(t.button("1Y")).toHaveAttribute("aria-pressed", "true");
  await expect(t.button("All")).toHaveAttribute("aria-pressed", "false");
  // The latest period is inside every range, so the selection stays.
  expect(await t.now()).toBe(last);
  expect(await t.max()).toBe(last);
  // About a year of trading days.
  const span = last - (await t.min());
  expect(span).toBeGreaterThan(240);
  expect(span).toBeLessThan(270);
  // Month ticks, and the axis refits to the visible periods.
  expect(await t.xTicks()).toMatch(/[A-Z][a-z]{2} \d{4}/);
  expect(await t.xTicks()).not.toBe(allX);
  expect(await t.yTicks()).not.toBe(allY);
  await expect(page.getByTestId("range-note")).toHaveText(
    /^Showing periods starting \d{1,2} \w{3} \d{4} to \d{1,2} \w{3} \d{4}\. The results above use all [\d,]+ periods\.$/,
  );
  // The glance, the comparison, the summary and the period detail: as before.
  expect(await restOfPage(page)).toBe(before);
  // Not in the URL, and All again on reload.
  expect(page.url()).toContain(Q);
  expect(page.url()).not.toMatch(/[?&]r=/);
  await page.reload();
  const again = await openTimeline(page);
  await expect(again.button("All")).toHaveAttribute("aria-pressed", "true");
});

test("narrowing the range snaps a selection outside it to the nearest visible period", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "keyboard");
  const t = await openTimeline(page);
  await t.slider.focus();
  await page.keyboard.press("Home");
  expect(await t.now()).toBe(0);
  await t.button("5Y").click();
  const min = await t.min();
  expect(min).toBeGreaterThan(0);
  expect(await t.now()).toBe(min);
  // The readout and the period detail follow.
  const date = await page.getByTestId("readout-date").textContent();
  await expect(
    page.getByRole("heading", { name: /^The period starting / }),
  ).toHaveText(`The period starting ${date}`);
  // Back to All: the selection stays where it is.
  await t.button("All").click();
  expect(await t.now()).toBe(min);
  expect(await t.min()).toBe(0);
});

test("keys stay inside the visible range", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard");
  const t = await openTimeline(page);
  await t.button("1Y").click();
  const min = await t.min();
  const max = await t.max();
  await t.slider.focus();
  await page.keyboard.press("Home");
  expect(await t.now()).toBe(min);
  await page.keyboard.press("ArrowLeft");
  expect(await t.now()).toBe(min);
  await page.keyboard.press("PageDown");
  expect(await t.now()).toBe(min);
  await page.keyboard.press("ArrowRight");
  expect(await t.now()).toBe(min + 1);
  await page.keyboard.press("End");
  expect(await t.now()).toBe(max);
  await page.keyboard.press("PageUp");
  expect(await t.now()).toBe(max);
  await expect(t.slider).toHaveAccessibleDescription(
    /for every period starting .* Home and End to the first and last period shown\./,
  );
});

test("dragging maps onto the visible range", async ({ page, isMobile }) => {
  test.skip(isMobile, "mouse drag");
  const t = await openTimeline(page);
  await t.button("5Y").click();
  const min = await t.min();
  const box = (await t.slider.locator("svg").boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 5 });
  await page.mouse.up();
  const now = await t.now();
  expect(now).toBeGreaterThan(min);
  expect(now).toBeLessThan(await t.max());
  // Left of the plot: the first visible period, never an earlier one.
  await page.mouse.move(box.x + 1, y);
  await page.mouse.down();
  await page.mouse.up();
  expect(await t.now()).toBe(min);
});

test("phones: 1Y draws daily periods, and the month buttons stop at its edge", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phones");
  const t = await openTimeline(page);
  const bands = page.getByText("Each band is a month's lowest to highest cost");
  await expect(bands).toBeVisible();
  await t.button("1Y").click();
  await expect(bands).toHaveCount(0);
  // No month bands drawn: one line per strategy.
  await expect(t.slider.locator("svg path[opacity]")).toHaveCount(0);
  const earlier = page.getByRole("button", { name: "Earlier month" });
  for (let i = 0; i < 14 && (await earlier.isEnabled()); i++)
    await earlier.click();
  await expect(earlier).toBeDisabled();
  expect(await t.now()).toBe(await t.min());
  // Targets stay large enough to tap.
  const box = (await t.button("1Y").boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await t.button("5Y").click();
  await expect(bands).toBeVisible();
});

test("the target field reads as the rate you'd wait for", async ({ page }) => {
  await page.goto(`/?${Q}`);
  await page.locator("summary", { hasText: "More options" }).click();
  const field = page.getByLabel("Rate you'd wait for (target)");
  await expect(field).toHaveValue("2");
  await expect(field).toHaveAccessibleDescription(
    "% below the starting rate. Used by the Target rate strategy.",
  );
});

// The direction line must not push the answer under the tab bar: at 375 the
// first row of results stays in view, at 430 all four.
for (const [width, height, rows] of [
  [375, 812, 1],
  [430, 932, 4],
] as const)
  test(`phones: at ${width}x${height} the first screen shows ${rows} result row(s)`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`/?${Q}`);
    const row = page
      .getByRole("region", { name: "Comparison at a glance" })
      .locator("tbody tr")
      .nth(rows - 1);
    await expect(row).toBeVisible();
    await page.waitForTimeout(500);
    const box = (await row.boundingBox())!;
    // The fixed tab bar is 56px tall.
    expect(box.y + box.height).toBeLessThanOrEqual(height - 56);
    await ctx.close();
  });
