import { expect, test, type Page } from "@playwright/test";
import { BANNED_IN_UI_TEXT as ADVISORY } from "../tests/advisory-patterns.ts";

/** Opens the currency picker, searches, and picks the matching currency. */
async function pickCurrency(page: Page, search: string, code: string) {
  await page.getByLabel("Currency you need").click();
  await page.getByPlaceholder("Country, currency or code").fill(search);
  await page.getByRole("option", { name: new RegExp(`\\b${code}\\b`) }).click();
}

/** The mid-rate line under today's cost, e.g. "S$19,188 at mid rate, …". */
const MID_HINT = /^S\$[\d,.]+ at mid rate, before your/;
const firstSgd = (text: string | null) =>
  Number(/S\$([\d,.]+)/.exec(text ?? "")![1]!.replaceAll(",", ""));

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
    page.getByRole("group", { name: /Range of SGD cost/ }),
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
  await expect(page.getByLabel("Currency you need")).toHaveText(/\bEUR\b/);
  await expect(page.getByLabel("Amount needed (EUR)")).toHaveValue("8000");
  await expect(page.getByTestId("summary")).toContainText(
    "spreading over 4 conversions",
  );

  await page.getByText("More options").click();
  await page.getByLabel("Most conversions you'd make").fill("3");
  await expect(page).toHaveURL(/k=3/);
  await expect(page.getByTestId("summary")).toContainText(
    "spreading over 3 conversions",
  );
});

test("downloads the selected window as an .xlsx", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: /^Download Excel/ });
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

  // Read the S$ hint at 15,000 first, so the check below doesn't depend on
  // today's USD/SGD rate.
  const hint = page.getByText(MID_HINT);
  const sgd = async () => firstSgd(await hint.textContent());
  const at15000 = await sgd();

  const amount = page.getByLabel("Amount needed (USD)");
  await amount.fill("");
  await amount.pressSequentially("4000", { delay: 60 });
  await expect(page).toHaveURL(/[?&]a=4000(&|$)/);
  await page.waitForTimeout(500);

  expect(routeRequests).toEqual([]);
  expect(await page.evaluate(() => history.length)).toBe(historyBefore);
  await expect(page.getByLabel("Amount needed (USD)")).toHaveValue("4000");
  // The hint follows the new amount at the same rate.
  await expect.poll(sgd).toBeCloseTo((at15000 * 4000) / 15000, -1);
});

test("back/forward and links still drive the state from the URL", async ({
  page,
}) => {
  await page.goto("/?c=USD&a=9000&s=2026-10-17&d=2027-06-01&k=3&sp=0.5&t=2");
  await expect(page.getByLabel("Amount needed (USD)")).toHaveValue("9000");
  await page.goto("/?c=EUR&a=7000&s=2026-10-17&d=2027-06-01&k=3&sp=0.5&t=2");
  await expect(page.getByLabel("Currency you need")).toHaveText(/\bEUR\b/);
  await page.goBack();
  await expect(page.getByLabel("Currency you need")).toHaveText(/\bUSD\b/);
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
  const button = page.getByRole("button", { name: /^Download Excel/ });
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
  await page.goto("/?c=EUR");
  await expect(page.getByTestId("fx-source")).toHaveText(
    "Source: ECB euro reference rate.",
  );
  await page.goto("/?c=VND");
  await expect(page.getByTestId("fx-source")).toHaveText(
    "Source: Frankfurter blended rates; daily volatility may be understated.",
  );
  await page.goto("/?c=BRL");
  await expect(page.getByTestId("fx-source")).toHaveText(
    "Source: ECB euro reference rates (SGD cross derived via EUR).",
  );
  // The footer attributes the ECB and says the SGD crosses are derived.
  await expect(page.getByRole("contentinfo")).toContainText(
    "European Central Bank euro reference rates (SGD crosses derived via EUR by SpotCheck)",
  );
});

for (const currency of ["JPY", "KRW", "IDR", "VND"]) {
  test(`${currency} 15,000: SGD figures stay readable and tick labels never repeat`, async ({
    page,
  }) => {
    await page.goto(
      `/?c=${currency}&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2`,
    );
    const chart = page.getByRole("group", { name: /Range of SGD cost/ });
    await expect(chart).toBeVisible();

    // Outcome chart: axis labels distinct.
    const axis = await chart.locator("text.tabular-nums").allTextContents();
    const ticks = axis.filter((t) => /^S\$/.test(t));
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ticks).size, ticks.join(" | ")).toBe(ticks.length);

    // Medians under S$100 show cents; S$100+ whole dollars.
    for (const m of axis.filter((t) => t.startsWith("median "))) {
      const value = Number(m.replace(/[^\d.]/g, ""));
      if (value < 100) expect(m).toMatch(/\.\d\d$/);
      else expect(m).not.toMatch(/\./);
    }

    // Sample-path rate axis: labels distinct.
    const yTicks = await page
      .locator(
        ".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value",
      )
      .allTextContents();
    expect(yTicks.length).toBeGreaterThanOrEqual(2);
    expect(new Set(yTicks).size, yTicks.join(" | ")).toBe(yTicks.length);
  });
}

test("switching currency keeps the SGD value of the amount", async ({
  page,
}) => {
  await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2");
  const amountHint = page.getByText(MID_HINT);
  const sgd = async () => firstSgd(await amountHint.textContent());
  await expect(amountHint).toBeVisible();
  const before = await sgd();

  // Found by country name, not just by code.
  await pickCurrency(page, "Vietnam", "VND");
  const vnd = page.getByLabel("Amount needed (VND)");
  await expect(vnd).toHaveValue(/^\d{3}0+$/); // 3 significant figures
  await expect(amountHint).toBeVisible();
  expect(Math.abs((await sgd()) / before - 1)).toBeLessThan(0.01);
  // The URL carries the converted amount (whatever today's VND rate is).
  await expect(page).toHaveURL(
    new RegExp(`c=VND&a=${await vnd.inputValue()}&`),
  );

  await pickCurrency(page, "USD", "USD");
  const back = Number(
    await page.getByLabel("Amount needed (USD)").inputValue(),
  );
  expect(Math.abs(back / 15_000 - 1)).toBeLessThan(0.01);
});

test("a shared link's amount is taken as written, never converted", async ({
  page,
}) => {
  await page.goto("/?c=VND&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2");
  await expect(page.getByTestId("summary")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByLabel("Amount needed (VND)")).toHaveValue("15000");
  await expect(page).toHaveURL(/a=15000/);
});

test("today's cost matches the All at once result, including the spread", async ({
  page,
}) => {
  await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2");
  const lump = page.getByRole("button", { name: /^All at once: median S\$/ });
  await expect(lump).toBeVisible();
  const median = /median (S\$\d{1,3}(?:,\d{3})*(?:\.\d\d)?)/.exec(
    (await lump.getAttribute("aria-label"))!,
  )![1]!;
  await expect(page.getByTestId("today-cost")).toHaveText(median);
  // The mid-rate figure underneath is the same cost without the 0.5% spread.
  const mid = firstSgd(await page.getByText(MID_HINT).textContent());
  expect(firstSgd(median) / mid).toBeCloseTo(1.005, 4);
});

test("the converter and today's cost are visible without scrolling", async ({
  page,
}) => {
  await page.goto("/");
  for (const control of [
    page.getByLabel(/^Amount needed/),
    page.getByLabel("Currency you need"),
    page.getByLabel("Needed by"),
    page.getByTestId("today-cost"),
  ]) {
    await expect(control).toBeInViewport({ ratio: 1 });
  }
});

for (const path of ["/", "/advanced"]) {
  test(`${path}: no advisory wording anywhere on the page`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page.getByRole("group").first()).toBeVisible();
    // Open every disclosure so hidden text is checked too.
    for (const d of await page.locator("details").all())
      await d.evaluate((el) => el.setAttribute("open", ""));
    const text = await page.locator("body").innerText();
    for (const banned of ADVISORY) expect(text).not.toMatch(banned);
  });
}
