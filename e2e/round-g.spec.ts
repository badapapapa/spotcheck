import { expect, test, type Page } from "@playwright/test";

// PR G, from the external QA review: clearer wording and states. Copy and
// display only; the figures don't change (see the parity check).

const Q = "c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2";

async function settled(page: Page) {
  await page
    .getByTestId("results-status")
    .filter({ hasText: /updated/i })
    .waitFor({ state: "attached" });
}

test.describe("F07: privacy, said precisely", () => {
  test("About says what a link shares and what analytics records", async ({
    page,
  }) => {
    await page.goto("/how-it-works");
    const p = page.getByTestId("privacy");
    await expect(p).toContainText("No account and no cookies.");
    await expect(p).toContainText(
      "anyone you share a link with sees its amount, currency, dates and settings",
    );
    await expect(p).toContainText("Cloudflare Web Analytics");
    await expect(p).toContainText("not the scenario in its address");
    await expect(page.locator("main")).not.toContainText("stores nothing");
  });

  test("Copy link says what the link includes", async ({ page }) => {
    await page.goto(`/?${Q}`);
    await settled(page);
    await expect(page.getByTestId("link-note")).toHaveText(
      "The link includes this plan's amount, currency, dates and settings.",
    );
  });

  test("nothing is stored in the browser", async ({ page }) => {
    await page.goto(`/?${Q}`);
    await settled(page);
    await page.getByLabel("Amount needed (USD)").fill("20000");
    await page
      .getByRole("link", { name: /^Hedging/ })
      .first()
      .click();
    await page.waitForURL(/advanced/);
    const stored = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookie: document.cookie,
    }));
    expect(stored).toEqual({ local: 0, session: 0, cookie: "" });
    expect(await page.context().cookies()).toEqual([]);
  });
});

test.describe("F08: Hedging is USD only", () => {
  test("the nav says so before the click", async ({ page }) => {
    await page.goto(`/?${Q}`);
    await expect(
      page.getByRole("link", { name: "Hedging (USD)" }).first(),
    ).toBeVisible();
  });

  test("Switch to USD says what it prices and keeps the plan for the planner", async ({
    page,
  }) => {
    await page.goto(
      "/advanced?c=JPY&a=500000&s=2026-10-17&d=2027-03-01&k=4&sp=1&t=3",
    );
    await expect(
      page.getByText(/Hedging prices USD only for now/),
    ).toBeVisible();
    await expect(
      page.getByText(
        "This prices USD 500,000 instead: the same number, in US dollars. Your plan on the planner stays JPY 500,000.",
      ),
    ).toBeVisible();
    await page.getByTestId("switch-to-usd").click();
    await expect(page.getByLabel("Amount needed (USD)")).toHaveValue("500,000");
    await expect(page.getByTestId("switched-from")).toContainText(
      "Switched to USD from JPY 500,000",
    );
    await expect(page).toHaveURL(/c=USD/);
    await expect(page).toHaveURL(/from=JPY\.500000/);
    // An edit on Hedging doesn't change the plan the planner keeps.
    await page.getByLabel("Amount needed (USD)").fill("3000");
    await expect(page).toHaveURL(/a=3000/);
    const planner = page.getByRole("link", { name: "Planner" }).first();
    const href = (await planner.getAttribute("href"))!;
    expect(href).toContain("c=JPY");
    expect(href).toContain("a=500000");
    expect(href).not.toContain("from=");
    await planner.click();
    await expect(page.getByLabel("Amount needed (JPY)")).toHaveValue("500,000");
    await expect(page).not.toHaveURL(/from=/);
  });

  test("the planner opened with a switch in the address shows the original plan", async ({
    page,
  }) => {
    await page.goto(
      "/?c=USD&a=500000&s=2026-10-17&d=2027-03-01&k=4&sp=1&t=3&from=JPY.500000",
    );
    await expect(page.getByLabel("Amount needed (JPY)")).toHaveValue("500,000");
    await expect(page).not.toHaveURL(/from=/);
  });

  test("a bad `from` is ignored", async ({ page }) => {
    await page.goto(`/advanced?${Q}&from=XYZ.12`);
    await settled(page);
    await expect(page.getByTestId("switched-from")).toHaveCount(0);
    const href = (await page
      .getByRole("link", { name: "Planner" })
      .first()
      .getAttribute("href"))!;
    expect(href).toContain("c=USD");
    expect(href).not.toContain("from=");
  });
});

test("F06: the start dates shown, and the summary's scope, above the chart", async ({
  page,
}) => {
  await page.goto(`/?${Q}`);
  await settled(page);
  const group = page.getByRole("group", { name: "Start dates shown" });
  await group.scrollIntoViewIfNeeded();
  await expect(page.getByText("Start dates shown")).toBeVisible();
  await group.getByRole("button", { name: /^1Y \(/ }).click();
  const note = page.getByTestId("range-note");
  await expect(note).toContainText("Summary figures still use all periods.");
  const chart = page.getByRole("slider", { name: "Start of the period" });
  const [n, c] = [(await note.boundingBox())!, (await chart.boundingBox())!];
  expect(n.y + n.height).toBeLessThanOrEqual(c.y);
});

test.describe("F09: results that aren't current name the plan they are for", () => {
  test("the full last valid entry, and labelled Copy link and Excel", async ({
    page,
  }) => {
    await page.goto(`/?${Q}`);
    await settled(page);
    await page.getByLabel("Amount needed (USD)").fill("1.500,50");
    await expect(page.getByTestId("outdated")).toHaveText(
      "Not current: these are for your last valid entry: USD 15,000 by 1 Aug 2027, from 17 Oct 2026, 6 conversions, 0.5% fee, 2% target.",
    );
    await expect(
      page.getByRole("button", { name: "Copy link to that entry" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Download Excel for that entry/ }),
    ).toBeAttached();
    // Fixed: back to the usual labels.
    await page.getByLabel("Amount needed (USD)").fill("16000");
    await expect(page.getByTestId("outdated")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Copy link to this scenario" }),
    ).toBeVisible();
  });

  test("the copied link is that entry's", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permission");
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/?${Q}`);
    await settled(page);
    await page.getByLabel("Amount needed (USD)").fill("1.500,50");
    await page.getByRole("button", { name: "Copy link to that entry" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("a=15000");
    expect(copied).toContain("c=USD");
  });
});

test("F05: on phones, a link from the glance to the timeline, clear of the bars", async ({
  page,
  isMobile,
}) => {
  await page.goto(`/?${Q}`);
  await settled(page);
  const link = page.getByTestId("explore-link");
  if (!isMobile) {
    await expect(link).toBeHidden();
    return;
  }
  await link.click();
  await page.waitForTimeout(800);
  const heading = page.getByRole("heading", {
    name: "What if you had converted in another period?",
  });
  await expect(heading).toBeInViewport();
  const h = (await heading.boundingBox())!;
  // Below the fixed summary bar.
  const bar = await page.locator(".summary-bar").boundingBox();
  expect(h.y).toBeGreaterThanOrEqual(bar ? bar.y + bar.height : 0);
});

test("F03: a conversion moved off a weekend or holiday shows its schedule", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "keyboard");
  await page.goto(`/?${Q}`);
  await settled(page);
  const slider = page.getByRole("slider", { name: "Start of the period" });
  await slider.scrollIntoViewIfNeeded();
  await slider.focus();
  // Step back a month at a time until a period has a moved conversion.
  const notes = page.getByTestId("scheduled-note").filter({ visible: true });
  for (let i = 0; i < 24 && (await notes.count()) === 0; i++)
    await page.keyboard.press("PageDown");
  expect(await notes.count()).toBeGreaterThan(0);
  const item = notes.first().locator("xpath=..");
  const text = (await item.textContent())!.replace(/\s+/g, " ");
  const m = text.match(
    /^(\d{1,2} \w{3} \d{4}).*\(scheduled (\d{1,2} \w{3} \d{4}); the next published rate\)$/,
  );
  expect(m, text).not.toBeNull();
  // The rate's date comes after the scheduled one.
  expect(Date.parse(`${m![1]} UTC`)).toBeGreaterThan(
    Date.parse(`${m![2]} UTC`),
  );
});

test.describe("Range chart at huge amounts", () => {
  const boxes = (page: Page, sel: string) =>
    page.locator(`#evidence figure svg ${sel}`).evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { l: r.left, r: r.right, t: r.top, b: r.bottom };
      }),
    );

  test("320px, EUR 1e12: compact ticks and medians under the names, nothing touching", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 320, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(
      "/?c=EUR&a=1000000000000&s=2026-11-07&d=2029-11-07&k=24&sp=5&t=20",
    );
    await settled(page);
    await page.waitForTimeout(500);
    const ticks = page.locator("#evidence figure svg text.text-chart");
    const labels = await ticks.allTextContents();
    for (const t of labels) expect(t).toMatch(/^S\$[\d.]+T$/);
    // The full value is the accessible name.
    for (const name of await ticks.evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label")),
    ))
      expect(name).toMatch(/^S\$\d,\d{3},\d{3},\d{3},\d{3}$/);
    const t = await boxes(page, "text.text-chart");
    for (let i = 1; i < t.length; i++)
      expect(t[i - 1]!.r).toBeLessThanOrEqual(t[i]!.l);
    // Each strategy's name above its median, not beside it.
    const names = await boxes(page, "text.font-medium");
    const medians = await boxes(page, "text.text-sm:not(.font-medium)");
    expect(names).toHaveLength(4);
    names.forEach((n, i) =>
      expect(medians[i]!.t).toBeGreaterThanOrEqual(n.b - 1),
    );
    await ctx.close();
  });

  test("320px, a normal amount: full ticks, and medians beside the names as before", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 320, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto("/?c=JPY&a=500000&s=2026-10-17&d=2027-03-01&k=4&sp=1&t=3");
    await settled(page);
    await page.waitForTimeout(500);
    for (const t of await page
      .locator("#evidence figure svg text.text-chart")
      .allTextContents())
      expect(t).toMatch(/^S\$\d{1,3}(,\d{3})*$/);
    const names = await boxes(page, "text.font-medium");
    const medians = await boxes(page, "text.text-sm:not(.font-medium)");
    names.forEach((n, i) => {
      expect(Math.abs(medians[i]!.t - n.t)).toBeLessThan(4);
      expect(n.r).toBeLessThanOrEqual(medians[i]!.l);
    });
    await ctx.close();
  });
});
