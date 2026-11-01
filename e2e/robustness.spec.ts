import { expect, test, type Page } from "@playwright/test";

// The stress-test fixes (PR A). Each test failed on the build before the
// fix. Dates are absolute where the data fixes them (1999, 2025) and
// relative to today where "today" is the point.

const todaySg = () =>
  new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
const plusDays = (iso: string, n: number) =>
  new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10);

const disclaimerVisible = (page: Page) =>
  expect(page.getByTestId("header-disclaimer")).toBeVisible();
const query = (page: Page) => new URL(page.url()).searchParams;

/** Every URL the page writes (history.replaceState) while `action` runs. */
async function urlsDuring(page: Page, action: () => Promise<void>) {
  await page.evaluate(() => {
    const w = window as unknown as { __urls?: string[] };
    if (!w.__urls) {
      w.__urls = [];
      const replace = history.replaceState.bind(history);
      history.replaceState = (s, t, u) => {
        w.__urls!.push(String(u));
        replace(s, t, u);
      };
    }
    w.__urls.length = 0;
  });
  await action();
  await page.waitForTimeout(900);
  return page.evaluate(
    () => (window as unknown as { __urls: string[] }).__urls,
  );
}

const openMore = async (page: Page) => {
  const more = page.locator("details").first();
  if (!(await more.evaluate((d: HTMLDetailsElement) => d.open)))
    await page.getByText("More options").first().click();
};

test.describe("A1: start dates outside the data", () => {
  test("a start before USD data begins explains itself, with a way out", async ({
    page,
  }) => {
    await page.goto("/?c=USD&a=15000&s=1999-01-01&d=1999-08-01");
    await disclaimerVisible(page);
    await expect(page.getByTestId("start-issue")).toContainText(
      "USD data starts 4 Jan 1999. Pick a start on or after that date.",
    );
    // Under the start field, which opens to show it.
    await expect(page.getByTestId("error-startDate")).toBeVisible();
    await expect(page.getByTestId("error-deadline")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Start on 4 Jan 1999 instead" })
      .click();
    await expect(page.getByTestId("summary")).toBeVisible();
    await expect.poll(() => query(page).get("s")).toBe("1999-01-04");
  });

  test("CNY, BRL, INR and ILS start in 2000", async ({ page }) => {
    for (const c of ["CNY", "BRL", "INR", "ILS"]) {
      await page.goto(`/?c=${c}&s=1999-06-01&d=2000-03-01`);
      await expect(page.getByTestId("start-issue")).toContainText(
        `${c} data starts 13 Jan 2000`,
      );
      await disclaimerVisible(page);
    }
  });

  test("Hedging explains the SORA look-back instead of crashing", async ({
    page,
  }) => {
    await page.goto("/advanced?c=USD&a=15000&s=2006-01-01&d=2006-08-01");
    await disclaimerVisible(page);
    await expect(page.getByTestId("start-issue")).toContainText(
      /SGD rates \(SORA\) begin on 1 Jul 2005\. Pick a start on or after \d+ \w+ 2006\./,
    );
  });

  test("far-future starts are capped, and no 30-year forward is priced", async ({
    page,
  }) => {
    await page.goto("/advanced?s=2060-01-03&d=2060-11-01");
    await disclaimerVisible(page);
    await expect(page.getByTestId("start-issue")).toContainText(
      /within a year/,
    );
    await expect(page.getByTestId("answer")).toHaveCount(0);
    await page.goto("/?s=2060-01-03&d=2060-11-01");
    await expect(page.getByTestId("start-issue")).toContainText(
      /within a year/,
    );
  });

  test("the planner at 2004, then Hedging: a message, not a crash", async ({
    page,
  }) => {
    await page.goto("/?c=USD&a=15000&s=2004-01-05&d=2004-11-01");
    await expect(page.getByTestId("summary")).toBeVisible();
    await page.getByRole("link", { name: "Hedging" }).click();
    await expect(page).toHaveURL(/\/advanced/);
    await disclaimerVisible(page);
    await expect(page.getByTestId("start-issue")).toContainText(/SORA/);
  });

  test("the date pickers know the data's limits", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("summary")).toBeVisible();
    await openMore(page);
    const start = page.getByLabel("Start converting from");
    await expect(start).toHaveAttribute("min", "1999-01-04");
    await expect(start).toHaveAttribute("max", /^\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByLabel("Needed by")).toHaveAttribute(
      "max",
      /^\d{4}-/,
    );
  });

  test("an error anywhere keeps the header, nav and disclaimer", async ({
    page,
  }) => {
    // Make the planner throw while rendering, whatever the cause.
    await page.addInitScript(() => {
      Number.prototype.toLocaleString = () => {
        throw new Error("test: forced render error");
      };
    });
    await page.goto("/?c=USD&a=15000");
    await expect(page.getByTestId("page-error")).toBeVisible();
    await disclaimerVisible(page);
    await expect(
      page.getByRole("link", {
        name: "Open the planner with the default plan",
      }),
    ).toHaveAttribute("href", "/");
  });
});

test.describe("A2: wording follows the start date", () => {
  test("a past start is priced on its own day, not 'today'", async ({
    page,
  }) => {
    await page.goto("/?c=USD&a=15000&s=2025-01-02&d=2025-08-01");
    await expect(page.getByTestId("summary")).toBeVisible();
    await expect(page.getByTestId("convert-when")).toHaveText(
      "Converting it all on 2 Jan 2025",
    );
    await expect(page.getByTestId("rate-line")).toHaveText(
      /^Mid rate on 2 Jan 2025: 1\.3\d{3} SGD per USD\.$/,
    );
    await expect(page.getByTestId("summary")).not.toContainText("known today");
    await expect(page.getByTestId("summary")).toContainText(
      "known on that day",
    );
    await expect(page.getByTestId("past-deadline")).toContainText(
      "Your deadline, 1 Aug 2025, has passed.",
    );
  });

  test("a future start says it uses the latest rate", async ({ page }) => {
    const s = plusDays(todaySg(), 120);
    await page.goto(`/?c=USD&a=15000&s=${s}&d=${plusDays(s, 200)}`);
    await expect(page.getByTestId("summary")).toBeVisible();
    await expect(page.getByTestId("convert-when")).toHaveText(
      "Converting it all at the latest rate",
    );
    await expect(page.getByTestId("summary")).not.toContainText("known today");
    await expect(page.getByTestId("summary")).toContainText("isn't known yet");
  });

  test("Hedging names the day it prices on", async ({ page }) => {
    await page.goto("/advanced?c=USD&a=15000&s=2025-01-02&d=2025-08-01");
    await expect(page.getByTestId("answer")).toContainText(
      /(below|above) the spot on 2 Jan 2025 for your/,
    );
    await expect(page.getByText("Fixing the rate on 2 Jan 2025")).toBeVisible();
    await expect(page.getByTestId("answer")).not.toContainText("today");
  });
});

test.describe("A3/A4: typed numbers", () => {
  test.use({ locale: "de-DE", timezoneId: "Europe/Berlin" });

  test("European forms get a message, never a silent different number", async ({
    page,
  }) => {
    await page.goto("/?c=EUR&a=15000&s=2026-10-17&d=2027-08-01");
    await expect(page.getByTestId("summary")).toBeVisible();
    const amount = page.getByLabel("Amount needed (EUR)");
    for (const [typed, msg] of [
      ["15.000", "Write thousands without dots, e.g. 15000 or 15,000."],
      [
        "1.500,50",
        "Use a dot for decimals and commas for thousands, e.g. 1,500.50.",
      ],
      ["15,5", "Use a dot for decimals, e.g. 0.5."],
      ["١٥٠٠٠", "Use the digits 0–9."],
    ] as const) {
      await amount.fill(typed);
      await expect(page.getByTestId("error-amount")).toHaveText(msg);
      await expect(amount).toHaveValue(typed);
    }
    await page.waitForTimeout(800);
    expect(query(page).get("a")).toBe("15000");
    await amount.fill("15 000");
    await amount.blur();
    await expect.poll(() => query(page).get("a")).toBe("15000");
  });

  test("spread '0,5' is not read as 5%", async ({ page }) => {
    await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01&sp=1");
    await expect(page.getByTestId("summary")).toBeVisible();
    await openMore(page);
    const spread = page.getByLabel("Exchange fee (spread, %)");
    await spread.fill("0,5");
    await expect(page.getByTestId("error-spread")).toHaveText(
      "Use a dot for decimals, e.g. 0.5.",
    );
    await page.waitForTimeout(800);
    expect(query(page).get("sp")).toBe("1");
  });

  test("the parsed amount is echoed while typing", async ({ page }) => {
    await page.goto("/?c=EUR&a=15000&s=2026-10-17&d=2027-08-01");
    const amount = page.getByLabel("Amount needed (EUR)");
    await amount.fill("250000");
    await expect(page.getByTestId("amount-echo")).toHaveText("= EUR 250,000");
    await amount.blur();
    await expect(amount).toHaveValue("250,000");
  });
});

test.describe("A4: partial values", () => {
  test("typing 15, 36 or 1000 never commits 1, 3 or 10", async ({ page }) => {
    await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2");
    await expect(page.getByTestId("summary")).toBeVisible();
    await openMore(page);
    const cases = [
      ["Exchange fee (spread, %)", "15", "sp", "Enter 0–5%.", "spread"],
      [
        "Most conversions you'd make",
        "36",
        "k",
        "Enter a whole number from 1 to 24.",
        "tranches",
      ],
      [
        "Target: % below the starting rate",
        "1000",
        "t",
        "Enter 0–20%.",
        "target",
      ],
    ] as const;
    for (const [label, typed, param, msg, name] of cases) {
      const before = query(page).get(param);
      const field = page.getByLabel(label);
      const urls = await urlsDuring(page, async () => {
        await field.fill("");
        await field.pressSequentially(typed, { delay: 80 });
      });
      await expect(page.getByTestId(`error-${name}`)).toHaveText(msg);
      for (const u of urls)
        expect(new URL(u, page.url()).searchParams.get(param)).toBe(before);
      // The old results stay up, marked as not current.
      await expect(page.getByTestId("outdated")).toBeVisible();
      await field.fill(before!);
      await field.blur();
      await expect(page.getByTestId("outdated")).toHaveCount(0);
    }
  });

  test("errors state the real limits", async ({ page }) => {
    await page.goto("/");
    const amount = page.getByLabel("Amount needed (USD)");
    await amount.fill("0");
    await expect(page.getByTestId("error-amount")).toHaveText(
      "Enter an amount from 1 to 1,000,000,000,000.",
    );
  });

  test("a start-date error sits under the start field", async ({ page }) => {
    await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01");
    await expect(page.getByTestId("summary")).toBeVisible();
    await openMore(page);
    await page.getByLabel("Start converting from").fill("2027-07-30");
    await expect(page.getByTestId("error-startDate")).toHaveText(
      "The deadline must be at least a week after the start.",
    );
    await expect(page.getByTestId("error-deadline")).toHaveCount(0);
  });

  test("volatility says 1–100% and never drops a keystroke", async ({
    page,
  }) => {
    await page.goto("/advanced?c=USD&a=15000&s=2026-10-17&d=2027-08-01");
    const vol = page.getByLabel("Volatility (% a year)");
    await expect(vol).toBeVisible();
    for (const typed of ["101", "250", "0", "-5", "0.5", "abc"]) {
      const urls = await urlsDuring(page, async () => {
        await vol.fill("");
        await vol.pressSequentially(typed, { delay: 60 });
      });
      await expect(vol).toHaveValue(typed);
      await expect(page.getByTestId("vol-note")).toHaveText(
        "Enter 1–100%, or leave it empty for realised volatility.",
      );
      // "101" never becomes v=10 on its way through.
      for (const u of urls)
        expect(new URL(u, page.url()).searchParams.get("v")).not.toBe("10");
    }
  });

  test("the mouse wheel doesn't change a focused number", async ({
    page,
  }, info) => {
    test.skip(info.project.name === "mobile", "needs a mouse wheel");
    await page.goto("/?c=USD&a=15000");
    const amount = page.getByLabel("Amount needed (USD)");
    await amount.focus();
    await amount.hover();
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(700);
    await expect(amount).toHaveValue("15,000");
    expect(query(page).get("a")).toBe("15000");
  });
});

test.describe("A5/A6: links and Copy link carry the scenario", () => {
  test("tabs follow every edit at once, not the URL's debounce", async ({
    page,
  }) => {
    await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01");
    await expect(page.getByTestId("summary")).toBeVisible();
    const amount = page.getByLabel("Amount needed (USD)");
    await amount.fill("9000");
    await amount.blur();
    const hedging = page.getByRole("link", { name: "Hedging" });
    await expect(hedging).toHaveAttribute("href", /a=9000/);
    await hedging.click();
    await expect(page.getByLabel("Amount needed (USD)")).toHaveValue("9,000");
  });

  test("from a bare '/', every internal link carries the full scenario", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("summary")).toBeVisible();
    const s = query(page).get("s") ?? todaySg();
    for (const name of ["Hedging", "How it works"])
      await expect(page.getByRole("link", { name })).toHaveAttribute(
        "href",
        new RegExp(`\\?.*s=${s}.*&d=`),
      );
    await page.getByRole("link", { name: "How it works" }).click();
    await expect(
      page.getByRole("link", { name: "Back to the planner" }),
    ).toHaveAttribute("href", /\/\?c=USD&a=15000&s=/);
    await page.getByRole("link", { name: "Hedging" }).click();
    await expect(
      page.getByRole("link", { name: "planner", exact: true }),
    ).toHaveAttribute("href", /\/\?c=USD&a=15000&s=/);
  });

  test("Copy link copies the scenario on screen, every setting included", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "clipboard permissions");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await expect(page.getByTestId("summary")).toBeVisible();
    const amount = page.getByLabel("Amount needed (USD)");
    await amount.fill("9000");
    // Straight away, inside the URL's 300 ms pause.
    await page.getByRole("button", { name: /Copy link/ }).click();
    const copied = new URL(
      await page.evaluate(() => navigator.clipboard.readText()),
    );
    const p = copied.searchParams;
    expect(p.get("a")).toBe("9000");
    for (const k of ["c", "s", "d", "k", "sp", "t", "ks", "vl"])
      expect(p.has(k), k).toBe(true);
  });
});

test.describe("A7: the BND peg", () => {
  test("the timeline draws, and the words say '(fixed)'", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/?c=BND&a=15000&s=2026-10-31&d=2027-07-31");
    await expect(page.getByTestId("summary")).toBeVisible();
    const timeline = page.getByRole("slider", { name: "Start of the period" });
    await timeline.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    for (const d of await timeline
      .locator("path")
      .evaluateAll((ps) => ps.map((p) => p.getAttribute("d") ?? "")))
      expect(d).not.toMatch(/NaN/);
    expect(errors.filter((e) => /NaN/.test(e))).toEqual([]);
    await expect(page.getByTestId("summary")).toContainText(
      /S\$15,075 \(fixed\)/,
    );
    await expect(page.getByTestId("summary")).not.toContainText(
      "S$15,075–S$15,075",
    );
    await expect(page.getByText(/The target was 0\.9800 /)).toBeVisible();
  });

  test("Hedging says the peg leaves nothing to hedge", async ({ page }) => {
    await page.goto("/advanced?c=BND&a=15000");
    await expect(
      page.getByText(
        /pegged 1:1 to the Singapore dollar, so there is no exchange rate to hedge/,
      ),
    ).toBeVisible();
    await expect(page.getByText(/needs BND interest-rate history/)).toHaveCount(
      0,
    );
  });
});

test.describe("A8: data that doesn't load", () => {
  const FRIENDLY =
    "Couldn't load the USD rate history. Check your connection and try again.";
  for (const [name, fulfil] of [
    ["aborted", (r: import("@playwright/test").Route) => r.abort()],
    [
      "HTTP 500",
      (r: import("@playwright/test").Route) => r.fulfill({ status: 500 }),
    ],
    [
      "bad JSON",
      (r: import("@playwright/test").Route) =>
        r.fulfill({ body: "{ not json" }),
    ],
    [
      "wrong shape",
      (r: import("@playwright/test").Route) =>
        r.fulfill({ json: { rates: "nope" } }),
    ],
  ] as const)
    test(`${name}: a plain message and Try again`, async ({ page }) => {
      await page.route("**/data/fx/SGD-USD.json", fulfil);
      await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01");
      await expect(page.getByTestId("load-error")).toContainText(FRIENDLY);
      await expect(page.locator("main")).not.toContainText(
        /Failed to fetch|JSON|Zod|HTTP|expected|Loading the rate history/,
      );
      await page.unroute("**/data/fx/SGD-USD.json");
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByTestId("summary")).toBeVisible();
    });

  test("a request that hangs times out after about 20 s", async ({ page }) => {
    await page.clock.install();
    await page.route("**/data/fx/SGD-USD.json", () => {
      /* never answers */
    });
    await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01");
    await page.waitForTimeout(500);
    await page.clock.runFor(21_000);
    await expect(page.getByTestId("load-error")).toContainText(
      "The USD rate history took too long to load.",
    );
  });
});

test.describe("A9: plan lengths", () => {
  test("a two-week plan reads '14-day' and fits its conversions", async ({
    page,
  }) => {
    await page.goto("/?c=USD&a=15000&s=2026-10-31&d=2026-11-14&k=24");
    await expect(page.getByTestId("summary")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("0-month");
    await expect(page.getByText(/^Every 14-day period since/)).toBeVisible();
    await expect(page.getByTestId("summary")).toContainText("(5 conversions)");
  });

  test("exactly three years across a leap year is allowed", async ({
    page,
  }) => {
    await page.goto("/?c=USD&a=15000&s=2026-10-31&d=2029-10-31");
    await expect(page.getByLabel("Needed by")).toHaveValue("2029-10-31");
  });

  test("URL values the form would reject fall back like the form", async ({
    page,
  }) => {
    await page.goto(
      "/advanced?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=1.5&ks=95.5",
    );
    await expect(page.getByText(/\(100% of spot\)/)).toBeVisible();
    await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=1.5");
    await expect(page.getByTestId("summary")).toContainText("(6 conversions)");
  });
});

test.describe("A10: figures", () => {
  test("counts have separators, differences match the rounded figures", async ({
    page,
  }) => {
    await page.goto("/?c=USD&a=15000&s=2026-10-31&d=2026-11-07&k=3");
    await expect(page.getByTestId("summary")).toContainText(
      /closer to \d{1,3}(,\d{3})+ separate histories/,
    );
    const num = (t: string) =>
      Number(t.replace(/[^\d.−-]/g, "").replace("−", "-"));
    const rows = page
      .getByRole("table", { name: /Median historical cost/ })
      .locator("tbody tr");
    const lump = num(await rows.nth(0).locator("td").nth(0).innerText());
    for (let i = 1; i < 4; i++) {
      const cells = rows.nth(i).locator("td");
      const median = num(await cells.nth(0).innerText());
      const diff = num(await cells.nth(1).innerText());
      expect(diff).toBeCloseTo(median - lump, 2);
    }
  });

  test("Hedging figures: minus signs, premium, carry, help tips, volatility", async ({
    page,
  }) => {
    await page.goto(
      "/advanced?c=USD&a=15000&s=2026-10-17&d=2027-08-01&ks=120&vl=60",
    );
    const points = page.getByText(/pips \(/);
    await expect(points).toHaveText(/^[−]?\d+\.\d pips \([−+]\d/);
    await expect(points).not.toHaveText(/-/);
    await expect(page.locator("main")).not.toContainText(/\de-\d/);
    // The carry reads the same in the headline and the forward panel.
    const head = /S\$[\d,]+(\.\d\d)?/.exec(
      await page.getByTestId("answer").innerText(),
    )![0];
    await expect(page.getByText(/the forward fixes a/)).toContainText(head);
    await expect(
      page.getByRole("button", { name: "About forward points" }),
    ).toBeVisible();
    await expect(page.getByTestId("vol-note")).toContainText(
      /from 60 daily changes, \d+ \w+ \d{4}–/,
    );
  });
});

test.describe("A11: data notes", () => {
  test("the planner shows the ISK note for ISK only", async ({ page }) => {
    await page.goto("/?c=ISK&a=1000000&s=2026-10-17&d=2027-08-01");
    await expect(page.getByTestId("data-note")).toContainText(
      "During Iceland's 2008 financial crisis the króna traded at two rates",
    );
    await page.goto("/?c=USD&a=15000&s=2026-10-17&d=2027-08-01");
    await expect(page.getByTestId("summary")).toBeVisible();
    await expect(page.getByTestId("data-note")).toHaveCount(0);
  });

  test("How it works always shows it, with the blended list", async ({
    page,
  }) => {
    for (const path of ["/how-it-works", "/how-it-works?c=USD&a=15000"]) {
      await page.goto(path);
      const note = page.getByTestId("data-note");
      await expect(note).toContainText("two rates");
      // Inside the Frankfurter blended entry.
      await expect(page.locator("dd", { has: note })).toContainText("ISK");
    }
  });
});
