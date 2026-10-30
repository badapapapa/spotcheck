import { expect, test } from "@playwright/test";

test("hedging tab prices a forward and an option for USD", async ({ page }) => {
  await page.goto(
    "/advanced?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2",
  );
  await expect(
    page.getByRole("heading", { name: "Hedging: forwards and options" }),
  ).toBeVisible();
  await expect(page.getByText("Today's forward")).toBeVisible();
  await expect(page.getByText(/Forward to 1 Aug 2027/)).toBeVisible();
  await expect(page.getByText("Premium per unit")).toBeVisible();
  await expect(
    page.getByRole("group", {
      name: /no hedge, a forward, and a call option/,
    }),
  ).toBeVisible();
  await expect(page.getByText("Not financial advice")).toBeVisible();
});

test("the strike slider updates the URL", async ({ page }) => {
  await page.goto("/advanced");
  const slider = page.getByLabel(/^Strike:/);
  await slider.fill("105");
  await expect(page).toHaveURL(/ks=105/);
  await expect(page.getByText(/105% of spot/)).toBeVisible();
});

test("other currencies get a USD-only notice", async ({ page }) => {
  await page.goto("/advanced?c=EUR");
  await expect(page.getByText(/only has for USD so far/)).toBeVisible();
});

test("the hedging headline states the forward's price", async ({ page }) => {
  await page.goto(
    "/advanced?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2",
  );
  const forward = page
    .getByText(/^Forward to 1 Aug 2027/)
    .locator("xpath=..")
    .locator("dd");
  const rate = (await forward.textContent())!.split(" ")[0]!;
  await expect(page.getByTestId("answer")).toContainText(
    `A forward would fix ${rate} SGD per USD for 1 Aug 2027`,
  );
});

test("the nav keeps the scenario when switching tabs", async ({ page }) => {
  await page.goto("/?c=USD&a=9000&s=2026-10-17&d=2027-06-01&k=3&sp=0.5&t=2");
  await page.getByRole("link", { name: "Hedging" }).click();
  await expect(page).toHaveURL(/\/advanced\?.*a=9000/);
  await expect(page.getByLabel("Amount needed (USD)")).toHaveValue("9000");
});

test("the payoff chart's 'today' label sits fully inside the chart", async ({
  page,
}) => {
  await page.goto("/advanced");
  const chart = page.getByRole("img", { name: /Total SGD cost against/ });
  await chart.scrollIntoViewIfNeeded();
  const label = chart.locator("text", { hasText: /^today$/ });
  await expect(label).toBeVisible();
  const [c, l] = await Promise.all([chart.boundingBox(), label.boundingBox()]);
  expect(l!.y).toBeGreaterThanOrEqual(c!.y);
  expect(l!.y + l!.height).toBeLessThanOrEqual(c!.y + c!.height);
});

test("hedging tab: ECB source shown, 250-day volatility by default", async ({
  page,
}) => {
  await page.goto("/advanced");
  await expect(page.getByTestId("fx-source")).toHaveText(
    /ECB euro reference rates/,
  );
  await expect(page.getByLabel("Realised volatility lookback")).toHaveValue(
    "250",
  );
  await expect(page.getByText(/from 250 trading days/)).toBeVisible();
});
