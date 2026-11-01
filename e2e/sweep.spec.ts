import { expect, test } from "@playwright/test";
import {
  BANNED_IN_UI_TEXT,
  STRATEGY_NAMES,
  STRATEGY_SENTENCE,
  comparesStrategies,
  namesRanking,
} from "../tests/advisory-patterns.ts";

// Thirty very different scenarios (ten currencies, three plan shapes): any
// wording, order or styling that depended on the results would show up in
// at least one. Every disclosure is opened first, so folded text (the plain
// words on phones, More options, the strategy details) is checked too.

const CURRENCIES = [
  "USD",
  "EUR",
  "JPY",
  "GBP",
  "AUD",
  "INR",
  "VND",
  "BRL",
  "ISK",
  "TRY",
];
const SHAPES = [
  "a=5000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2",
  "a=250000&s=2026-10-17&d=2026-10-31&k=2&sp=1&t=3",
  "a=1200&s=2026-10-17&d=2029-04-17&k=12&sp=0&t=5",
];
const SCENARIOS = CURRENCIES.flatMap((c) => SHAPES.map((s) => `c=${c}&${s}`));

test.describe.configure({ mode: "parallel" });

for (const q of SCENARIOS) {
  test(`sweep: ${q.split("&").slice(0, 2).join(" ")} ${q.split("&")[3]}`, async ({
    page,
  }) => {
    await page.goto(`/?${q}`);
    await expect(page.getByTestId("results-status")).toHaveText(
      /Results updated/,
    );
    for (const d of await page.locator("details").all())
      await d.evaluate((el) => el.setAttribute("open", ""));

    const main = await page.locator("main").innerText();
    for (const banned of BANNED_IN_UI_TEXT) expect(main).not.toMatch(banned);
    expect(namesRanking(main)).toBeUndefined();

    // The plain words: one template per strategy, in the fixed order, and
    // no sentence comparing two strategies.
    const summary = await page.getByTestId("summary").innerText();
    expect(comparesStrategies(summary)).toBeUndefined();
    const lines = summary.split("\n").filter((l) => STRATEGY_SENTENCE.test(l));
    expect(lines.map((l) => l.split(/[ :(]/).slice(0, 2).join(" "))).toEqual([
      "Equal tranches",
      "Wait until",
      "Target rate",
    ]);

    // The trend note, when there is one, passes the same detectors.
    const trend = page.getByTestId("trend-note");
    if (await trend.count()) {
      const t = await trend.innerText();
      for (const banned of BANNED_IN_UI_TEXT) expect(t).not.toMatch(banned);
      expect(namesRanking(t)).toBeUndefined();
      expect(comparesStrategies(t)).toBeUndefined();
    }

    // Fixed order in the glance, and every row styled the same.
    const glance = page.getByRole("region", { name: "Comparison at a glance" });
    expect(await glance.locator("tbody th").allTextContents()).toEqual(
      STRATEGY_NAMES,
    );
    // The classes of each row and its cells (the reference row's "–" has
    // its own inner markup by design, so cells' contents aren't compared).
    const rowClasses = await glance
      .locator("tbody tr")
      .evaluateAll((rows) =>
        rows.map((r) =>
          [r, ...r.children, ...r.querySelectorAll("button, .mark")]
            .map((el) => el.getAttribute("class") ?? "")
            .join("|"),
        ),
      );
    expect(new Set(rowClasses).size).toBe(1);
  });
}
