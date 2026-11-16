import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The footer's line about the nightly data-quality check (lib/quality.ts),
// on every page, matching data/quality.json.
const open = (
  JSON.parse(readFileSync("data/quality.json", "utf8")) as { open: unknown[] }
).open.length;

for (const path of ["/", "/advanced", "/how-it-works", "/404"])
  test(`the footer says how the data checks stand on ${path}`, async ({
    page,
  }) => {
    await page.goto(path);
    const line = page.getByTestId("data-checks");
    if (open === 0) await expect(line).toHaveText("Data checks passed");
    else
      await expect(line).toHaveText(
        new RegExp(`^${open} recent rates? under review: [A-Z]{3}, `),
      );
    // Quiet: the same muted Supporting text as the rates line above it.
    await expect(line).toHaveClass(/t-small/);
    await expect(line).toHaveClass(/text-muted-foreground/);
  });
