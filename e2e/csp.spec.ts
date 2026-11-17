import { createHash } from "node:crypto";
import { expect, test, type Page, type Response } from "@playwright/test";

// Every page runs under its own hash-based policy (scripts/csp-hashes.ts),
// with no 'unsafe-inline' scripts. Any violation fails the test, whether
// Chrome reports it as a securitypolicyviolation event or on the console.

const Q = "c=USD&a=9000&s=2026-10-17&d=2027-06-01&k=3&sp=0.5&t=2";

/** Collects violations from every document the page loads. */
async function watch(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) =>
      console.error(
        `CSP violation: ${e.violatedDirective} ${e.blockedURI} ${e.sample}`,
      ),
    );
  });
  page.on("console", (m) => {
    if (/Content Security Policy|CSP violation|Refused to /i.test(m.text()))
      seen.push(m.text());
  });
  return seen;
}

/** React has attached to the page (its props sit on rendered elements). */
async function hydrated(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll("a, button")].some((el) =>
          Object.keys(el).some((k) => k.startsWith("__reactProps")),
        ),
      ),
    )
    .toBe(true);
}

/**
 * The response's policy: one, hash-based, allowing every inline script.
 * Returns how many JSON-LD blocks the page has.
 */
async function checkPolicy(res: Response) {
  const policy = res.headers()["content-security-policy"]!;
  // Two policies joined with ", " would both apply; there is one.
  expect(policy).not.toContain(", ");
  const scripts = policy.split(";").find((d) => d.includes("script-src"))!;
  expect(scripts).not.toMatch(/'unsafe-inline'|'unsafe-hashes'/);
  // Hashed here, independently of the build script.
  const html = await res.text();
  const hash = (text: string) =>
    `'sha256-${createHash("sha256").update(text).digest("base64")}'`;
  const inline = [
    ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi),
  ].filter((m) => !/\bsrc\s*=/i.test(m[1]!));
  // The planner's JSON-LD is data, not a script: it needs no hash, and has
  // none, so its text could never be allowed to run.
  const isData = (attrs: string) => /type="application\/ld\+json"/.test(attrs);
  const run = inline.filter((m) => !isData(m[1]!));
  expect(run.length).toBeGreaterThan(0);
  for (const m of run) expect(scripts).toContain(hash(m[2]!));
  for (const m of inline.filter((m) => isData(m[1]!)))
    expect(scripts).not.toContain(hash(m[2]!));
  return inline.filter((m) => isData(m[1]!)).length;
}

/** Loads the lazy parts (the timeline, the period detail) too. */
async function scrollThrough(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
}

const PAGES = [
  { path: `/?${Q}`, ready: /Results updated/, jsonLd: 1 },
  { path: `/advanced?${Q}`, ready: /Hedge results updated/ },
  { path: "/how-it-works" },
  { path: "/404" },
  // Cloudflare serves 404.html for an unknown path, under the /* rule.
  { path: "/no-such-page", status: 404 },
];

for (const { path, ready, status = 200, jsonLd = 0 } of PAGES)
  test(`no CSP violations on ${path.split("?")[0]}`, async ({ page }) => {
    const seen = await watch(page);
    const res = (await page.goto(path))!;
    expect(res.status()).toBe(status);
    expect(await checkPolicy(res)).toBe(jsonLd);
    await hydrated(page);
    if (ready)
      await expect(page.getByTestId("results-status")).toHaveText(ready);
    await scrollThrough(page);
    expect(seen).toEqual([]);
  });

test("no CSP violations switching tabs", async ({ page }) => {
  const seen = await watch(page);
  await page.goto(`/?${Q}`);
  await expect(page.getByTestId("results-status")).toHaveText(
    /Results updated/,
  );
  await page.getByRole("link", { name: "Hedging (USD)" }).click();
  await expect(page).toHaveURL(/\/advanced\?/);
  await expect(page.getByTestId("results-status")).toHaveText(
    /Hedge results updated/,
  );
  await page.getByRole("link", { name: "How it works" }).first().click();
  await expect(page).toHaveURL(/\/how-it-works/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How SpotCheck works",
  );
  await page.getByRole("link", { name: "Planner", exact: true }).click();
  await expect(page).toHaveURL(/\/(\?|$)/);
  await expect(page.getByTestId("results-status")).toHaveText(
    /Results updated/,
  );
  expect(seen).toEqual([]);
});

test("no CSP violations exporting to Excel", async ({ page }) => {
  const seen = await watch(page);
  await page.goto(`/?${Q}`);
  const button = page.getByRole("button", { name: /^Download Excel/ });
  await expect(button).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    button.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  expect(seen).toEqual([]);
});
