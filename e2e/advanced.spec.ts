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
    page.getByRole("img", { name: /no hedge, a forward, and a call option/ }),
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

test("the nav keeps the scenario when switching tabs", async ({ page }) => {
  await page.goto("/?c=USD&a=9000&s=2026-10-17&d=2027-06-01&k=3&sp=0.5&t=2");
  await page.getByRole("link", { name: "Hedging" }).click();
  await expect(page).toHaveURL(/\/advanced\?.*a=9000/);
  await expect(page.getByLabel("Amount needed (USD)")).toHaveValue("9000");
});
