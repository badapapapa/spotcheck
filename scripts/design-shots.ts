// Screenshot set for a design round: every page section and state at five
// widths in both themes, so before/ and after/ sets use identical filenames.
//
//   node scripts/design-shots.ts <base-url> <out-dir>
//   node scripts/design-shots.ts https://spotcheck-fx.pages.dev docs/design/round-d/before
//
// Only 375 and 1440 are committed; the other widths go to a git-ignored
// sibling folder, local/<set>/, so the repo stays small.
//
// Sections are clipped from a full-page capture, so the fixed phone bars only
// appear in the "-top" shots (where they matter) and never cover a section.

import { mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) {
  console.error("Usage: node scripts/design-shots.ts <base-url> <out-dir>");
  process.exit(1);
}
const COMMITTED = [375, 1440];
const localDir = join(dirname(outDir), "local", basename(outDir));
mkdirSync(outDir, { recursive: true });
mkdirSync(localDir, { recursive: true });

type Size = { w: number; h: number; touch: boolean; dpr: number };
const SIZES: Size[] = [
  { w: 375, h: 812, touch: true, dpr: 2 },
  { w: 430, h: 932, touch: true, dpr: 2 },
  { w: 768, h: 1024, touch: true, dpr: 1 },
  { w: 1440, h: 900, touch: false, dpr: 1 },
  { w: 1920, h: 1080, touch: false, dpr: 1 },
];
const THEMES = ["light", "dark"] as const;
const only = process.env.ONLY?.split(",");
const widths = process.env.WIDTHS?.split(",").map(Number);

async function ready(page: Page, status: RegExp) {
  await page
    .getByTestId("results-status")
    .filter({ hasText: status })
    .waitFor({ state: "attached", timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700); // the 150ms fades, lazy charts settling
}

/** A full-width clip of one element, padded, from a full-page capture. */
async function section(page: Page, file: string, selector: string, pad = 24) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = await el.boundingBox();
  if (!box) throw new Error(`${file}: ${selector} not found`);
  const scrollY = await page.evaluate(() => window.scrollY);
  const width = page.viewportSize()!.width;
  await page.screenshot({
    path: file,
    fullPage: true,
    type: "jpeg",
    quality: 72,
    clip: {
      x: 0,
      y: Math.max(0, box.y + scrollY - pad),
      width,
      height: box.height + 2 * pad,
    },
  });
}

/** Between two elements' tops: the timeline, which shares a band with the detail. */
async function between(page: Page, file: string, from: string, to: string) {
  const a = await page.locator(from).first().boundingBox();
  const b = await page.locator(to).first().boundingBox();
  if (!a || !b) throw new Error(`${file}: ${from} or ${to} not found`);
  await page.screenshot({
    path: file,
    fullPage: true,
    type: "jpeg",
    quality: 72,
    clip: {
      x: 0,
      y: a.y - 24,
      width: page.viewportSize()!.width,
      height: b.y - a.y + 24,
    },
  });
}

async function viewport(page: Page, file: string) {
  await page.screenshot({ path: file, type: "jpeg", quality: 72 });
}

type Shot = (
  ctx: BrowserContext,
  name: (state: string) => string,
) => Promise<void>;

const SHOTS: Record<string, Shot> = {
  async planner(ctx, name) {
    const page = await ctx.newPage();
    await page.goto(base + "/");
    await ready(page, /Results updated/);
    await viewport(page, name("planner-top"));
    await section(page, name("planner-comparison"), "#evidence");
    await section(page, name("planner-plain-words"), '[data-testid="summary"]');
    await between(
      page,
      name("planner-timeline"),
      'section[aria-labelledby="explore-title"] h2',
      'section[aria-labelledby="explore-title"] h3',
    );
    await section(
      page,
      name("planner-period"),
      'section[aria-labelledby="explore-title"] .border-t',
    );
    await section(
      page,
      name("planner-strategies"),
      'section[aria-labelledby="strategies-title"]',
    );
    await page.close();
  },

  async hedging(ctx, name) {
    const page = await ctx.newPage();
    await page.goto(base + "/advanced");
    await ready(page, /Hedge results updated/);
    await page.locator("#greeks-title").waitFor();
    await page.waitForTimeout(500);
    await viewport(page, name("hedging-top"));
    await section(
      page,
      name("hedging-forward"),
      'section[aria-labelledby="forward-title"]',
    );
    await section(
      page,
      name("hedging-option"),
      'section[aria-labelledby="option-title"]',
    );
    await section(
      page,
      name("hedging-greeks"),
      'section[aria-labelledby="greeks-title"]',
    );
    await section(
      page,
      name("hedging-history"),
      'section[aria-labelledby="history-title"]',
    );
    await page.close();
  },

  async how(ctx, name) {
    const page = await ctx.newPage();
    await page.goto(base + "/how-it-works");
    await page.evaluate(() => document.fonts.ready);
    await viewport(page, name("how-top"));
    await section(
      page,
      name("how-strategies"),
      'section[aria-labelledby="strategies-title"]',
    );
    await section(
      page,
      name("how-data"),
      'section[aria-labelledby="data-title"]',
    );
    await page.close();
  },

  async notFound(ctx, name) {
    const page = await ctx.newPage();
    await page.goto(base + "/no-such-page");
    await page.evaluate(() => document.fonts.ready);
    await viewport(page, name("404"));
    await page.close();
  },

  async picker(ctx, name) {
    const page = await ctx.newPage();
    await page.goto(base + "/");
    await ready(page, /Results updated/);
    await page.getByRole("combobox", { name: /Currency you need/ }).click();
    await page.getByRole("combobox", { name: /Search by country/ }).waitFor();
    await page.waitForTimeout(300);
    await viewport(page, name("picker-open"));
    await page.keyboard.type("zzz");
    await page.waitForTimeout(300);
    await viewport(page, name("picker-empty"));
    await page.close();
  },

  async invalid(ctx, name) {
    const page = await ctx.newPage();
    await page.goto(base + "/");
    await ready(page, /Results updated/);
    const amount = page.getByLabel(/Amount needed/);
    await amount.fill("1.500,50");
    await page.getByTestId("error-amount").waitFor();
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await viewport(page, name("state-invalid"));
    await page.close();
  },

  async dataError(ctx, name) {
    const page = await ctx.newPage();
    await page.route("**/data/fx/**", (r) => r.abort());
    await page.goto(base + "/");
    await page.getByTestId("load-error").first().waitFor({ timeout: 40_000 });
    await page.waitForTimeout(300);
    await viewport(page, name("state-data-error"));
    await page.close();
  },

  async loading(ctx, name) {
    const page = await ctx.newPage();
    // Hold every data file, so the page stays in its loading state.
    await page.route("**/data/**", () => new Promise(() => {}));
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    await viewport(page, name("state-loading"));
    await page.close();
  },
};

const browser: Browser = await chromium.launch();
for (const size of SIZES) {
  if (widths && !widths.includes(size.w)) continue;
  for (const theme of THEMES) {
    const ctx = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: size.dpr,
      isMobile: size.touch && size.w < 1024,
      hasTouch: size.touch,
      colorScheme: theme,
      locale: "en-SG",
      timezoneId: "Asia/Singapore",
    });
    // Warm the cache once, so the display: optional body font is used.
    const warm = await ctx.newPage();
    await warm.goto(base + "/how-it-works");
    await warm.evaluate(() => document.fonts.ready);
    await warm.close();
    for (const [key, shot] of Object.entries(SHOTS)) {
      if (only && !only.includes(key)) continue;
      const dir = COMMITTED.includes(size.w) ? outDir : localDir;
      await shot(ctx, (state) => join(dir, `${state}-${size.w}-${theme}.jpg`));
    }
    await ctx.close();
    console.log(`${size.w} ${theme} done`);
  }
}
await browser.close();
