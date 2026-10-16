import { expect, test } from "@playwright/test";

test("planner loads with defaults and shows the outcome chart", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Exchange money planner" }),
  ).toBeVisible();
  await expect(page.getByText("Not financial advice")).toBeVisible();
  // The chart's accessible label and one row per strategy.
  await expect(
    page.getByRole("img", { name: /Range of SGD cost/ }),
  ).toBeVisible();
  for (const name of [
    "All at once",
    "Equal tranches",
    "Wait until deadline",
    "Target rate",
  ]) {
    await expect(
      page.getByRole("button", { name: new RegExp(`^${name}: median S\\$`) }),
    ).toBeVisible();
  }
  await expect(page.getByTestId("summary")).toContainText(
    "overlapping windows",
  );
});

test("the scenario round-trips through the URL", async ({ page }) => {
  await page.goto("/?c=EUR&a=8000&s=2026-10-17&d=2027-06-01&k=4&sp=0.75&t=3");
  await expect(page.getByLabel("Currency you need")).toHaveValue("EUR");
  await expect(page.getByLabel("Amount needed (EUR)")).toHaveValue("8000");
  await expect(page.getByTestId("summary")).toContainText(
    "spreading over 4 conversions",
  );

  await page.getByLabel("Most conversions you'd make").fill("3");
  await expect(page).toHaveURL(/k=3/);
  await expect(page.getByTestId("summary")).toContainText(
    "spreading over 3 conversions",
  );
});
