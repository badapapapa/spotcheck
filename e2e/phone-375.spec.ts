import { devices, expect, test } from "@playwright/test";

// A 375px touch phone (the size of the iPhone the review used). These run in
// the "mobile" project only; the desktop project covers the same pages wide.
test.use({
  ...devices["Pixel 7"],
  viewport: { width: 375, height: 812 },
  hasTouch: true,
  isMobile: true,
});
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "mobile", "phone-only checks");
});

const Q = "c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2";

for (const path of [`/?${Q}`, `/advanced?${Q}`, "/how-it-works"]) {
  test(`375px: the disclaimer is visible on ${path.split("?")[0]}`, async ({
    page,
  }) => {
    await page.goto(path);
    const note = page.getByTestId("header-disclaimer");
    await expect(note).toHaveText("Historical data, not advice");
    await expect(note).toBeInViewport({ ratio: 1 });
  });
}

test("375px: tapping the payoff chart fills the readout; no floating tooltip", async ({
  page,
}) => {
  await page.goto(`/advanced?${Q}`);
  const chart = page.getByRole("img", { name: /Total SGD cost against/ });
  await chart.scrollIntoViewIfNeeded();
  const readout = page.getByTestId("payoff-readout");
  await expect(readout).toHaveText("Tap the chart to read the values.");
  const box = (await chart.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(240);
  await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height / 2);
  await expect(readout).toContainText(/^Rate on deadline [\d.]+: Unhedged S\$/);
  // The values sit in the readout row, never in a box over the chart.
  await expect(chart.locator(".recharts-tooltip-wrapper")).toBeEmpty();
});

test("375px: tapping the period chart fills its readout", async ({ page }) => {
  await page.goto(`/?${Q}`);
  const chart = page.getByRole("img", { name: /^SGD per USD from / });
  await chart.scrollIntoViewIfNeeded();
  const readout = page.getByTestId("rate-readout");
  await expect(readout).toHaveText("Tap the chart to read a rate.");
  const box = (await chart.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height / 2);
  await expect(readout).toContainText(/\d{4}: [\d.]+ SGD per USD$/);
  await expect(chart.locator(".recharts-tooltip-wrapper")).toBeEmpty();
});

test("375px: one month earlier lands a calendar month back", async ({
  page,
}) => {
  await page.goto(`/?c=USD&a=15000&s=2026-10-17&d=2026-11-17&k=2&sp=0.5&t=2`);
  const heading = page.getByRole("heading", { name: /^The period starting / });
  await expect(heading).toBeVisible();
  const date = async () =>
    new Date(
      (await heading.textContent())!.replace("The period starting ", "") +
        " UTC",
    ).getTime();
  const before = await date();
  await page.getByRole("button", { name: "One month earlier" }).click();
  await expect.poll(date).not.toBe(before);
  const days = (before - (await date())) / 86_400_000;
  // A calendar month, give or take the nearest trading day.
  expect(days).toBeGreaterThanOrEqual(27);
  expect(days).toBeLessThanOrEqual(34);
});

test("375px: the timeline is tall and its axis hugs the data", async ({
  page,
}) => {
  await page.goto(`/?${Q}`);
  const timeline = page.getByRole("img", { name: /^Cost of each strategy/ });
  await timeline.scrollIntoViewIfNeeded();
  const box = (await timeline.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(260);
  const ticks = (await timeline.locator("text").allTextContents())
    .filter((t) => t.startsWith("S$"))
    .map((t) => Number(t.replace(/[^\d.]/g, "")));
  const step = ticks[1]! - ticks[0]!;
  // About five ticks: S$1,000 apart for this scenario, not S$2,000.
  expect(step).toBeLessThanOrEqual(1000);
});

test("375px: each conversion sits on its own line", async ({ page }) => {
  await page.goto(`/?${Q}`);
  const row = page.getByRole("row", { name: /^Equal tranches/ });
  await row.scrollIntoViewIfNeeded();
  await expect(row.locator("li")).toHaveCount(6);
  await expect(row.locator("li").first()).toHaveText(
    /^\d{1,2} \w{3} \d{4} · [\d.]+$/,
  );
});
