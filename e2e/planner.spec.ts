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

test("downloads the selected window as an .xlsx", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", {
    name: /Download this window as \.xlsx/,
  });
  await expect(button).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    button.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^spotcheck-USD-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );
});

test("typing in the amount updates the URL once, without route requests or history entries", async ({
  page,
}) => {
  await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2");
  await expect(page.getByTestId("summary")).toBeVisible();
  const historyBefore = await page.evaluate(() => history.length);

  // Record every request from here on: page/route payloads would show up as
  // requests for "/", "/?…", "index.txt" or "_rsc".
  const routeRequests: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (
      url.pathname === "/" ||
      url.pathname.endsWith(".txt") ||
      url.searchParams.has("_rsc")
    ) {
      routeRequests.push(req.url());
    }
  });

  const amount = page.getByLabel("Amount needed (USD)");
  await amount.fill("");
  await amount.pressSequentially("4000", { delay: 60 });
  await expect(page).toHaveURL(/[?&]a=4000(&|$)/);
  await page.waitForTimeout(500);

  expect(routeRequests).toEqual([]);
  expect(await page.evaluate(() => history.length)).toBe(historyBefore);
  await expect(page.getByLabel("Amount needed (USD)")).toHaveValue("4000");
  await expect(
    page.getByText(/≈ S\$5,1\d\d at the latest mid rate/),
  ).toBeVisible();
});

test("back/forward and links still drive the state from the URL", async ({
  page,
}) => {
  await page.goto("/?c=USD&a=9000&s=2026-10-17&d=2027-06-01&k=3&sp=0.5&t=2");
  await expect(page.getByLabel("Amount needed (USD)")).toHaveValue("9000");
  await page.goto("/?c=EUR&a=7000&s=2026-10-17&d=2027-06-01&k=3&sp=0.5&t=2");
  await expect(page.getByLabel("Currency you need")).toHaveValue("EUR");
  await page.goBack();
  await expect(page.getByLabel("Currency you need")).toHaveValue("USD");
});

test("serves and links an apple-touch-icon", async ({ page, request }) => {
  const res = await request.get("/apple-touch-icon.png");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
  await page.goto("/");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /apple-touch-icon\.png/,
  );
});

test("ExcelJS is downloaded only when the user clicks Download", async ({
  page,
}) => {
  // Collect every script the page loads, with its source.
  const scripts: { url: string; body: Promise<string> }[] = [];
  page.on("response", (res) => {
    if (res.request().resourceType() === "script")
      scripts.push({ url: res.url(), body: res.text().catch(() => "") });
  });
  // A string that only appears inside ExcelJS's bundle.
  const isExcelJs = (src: string) => src.includes("xl/workbook.xml");

  await page.goto("/");
  const button = page.getByRole("button", {
    name: /Download this window as \.xlsx/,
  });
  await expect(button).toBeVisible();
  const before = await Promise.all(scripts.map((s) => s.body));
  expect(before.some(isExcelJs)).toBe(false);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    button.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const after = await Promise.all(scripts.map((s) => s.body));
  expect(after.some(isExcelJs)).toBe(true);
});

test("shows each currency's data source", async ({ page }) => {
  await page.goto("/?c=USD");
  await expect(page.getByTestId("fx-source")).toHaveText(
    "Source: ECB euro reference rates (SGD cross derived via EUR).",
  );
  await page.goto("/?c=BRL");
  await expect(page.getByTestId("fx-source")).toHaveText(
    "Source: Frankfurter blended rates; daily volatility may be understated.",
  );
  // The footer attributes the ECB and says the SGD crosses are derived.
  await expect(page.getByRole("contentinfo")).toContainText(
    "European Central Bank euro reference rates (SGD crosses derived via EUR by SpotCheck)",
  );
});
