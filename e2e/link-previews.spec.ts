import { expect, test, type Page } from "@playwright/test";
import {
  BANNED_IN_UI_TEXT,
  comparesStrategies,
  namesRanking,
} from "../tests/advisory-patterns.ts";

const SITE = "https://spotcheck-fx.pages.dev";
const IMAGE = `${SITE}/og-image.png`;

const PAGES = [
  { path: "/", og: "/", title: /^SpotCheck: what difference/ },
  { path: "/advanced", og: "/advanced", title: /^Hedging: / },
  { path: "/how-it-works", og: "/how-it-works", title: /^How it works/ },
];

// The tags come from the static HTML, whatever the browser's locale or size.
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "same HTML in every project");
});

const tag = (page: Page, attr: string) =>
  page.locator(`head meta[${attr}]`).getAttribute("content");

for (const { path, og, title } of PAGES) {
  test(`link preview tags on ${path}`, async ({ page }) => {
    await page.goto(path);
    expect(await tag(page, 'property="og:image"')).toBe(IMAGE);
    expect(await tag(page, 'name="twitter:image"')).toBe(IMAGE);
    expect(await tag(page, 'name="twitter:card"')).toBe("summary_large_image");
    expect(await tag(page, 'property="og:url"')).toBe(
      og === "/" ? SITE : `${SITE}${og}`,
    );

    const ogTitle = await tag(page, 'property="og:title"');
    expect(ogTitle).toMatch(title);
    expect(ogTitle).toBe(await page.title());
    expect(await tag(page, 'name="twitter:title"')).toBe(ogTitle);

    const description = (await tag(page, 'name="description"')) ?? "";
    expect(description).not.toBe("");
    expect(await tag(page, 'property="og:description"')).toBe(description);
    expect(await tag(page, 'name="twitter:description"')).toBe(description);

    // The rendered-page wording checks only see the body.
    const copy = `${ogTitle} ${description}`;
    for (const banned of BANNED_IN_UI_TEXT) expect(copy).not.toMatch(banned);
    expect(namesRanking(copy)).toBeUndefined();
    expect(comparesStrategies(copy)).toBeUndefined();
  });
}

test("the preview image is served as a PNG", async ({ request }) => {
  const res = await request.get("/og-image.png");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
});
