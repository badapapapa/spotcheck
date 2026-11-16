import { expect, test } from "@playwright/test";
import { WEB_APPLICATION } from "../lib/structured-data.ts";

// Canonical URLs, the planner's JSON-LD, and /sitemap.xml and /robots.txt
// as the static export serves them.

const SITE = "https://spotcheck-fx.pages.dev";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "same files in every project");
});

const canonical = (path: string) => (path === "/" ? SITE : `${SITE}${path}`);

for (const path of ["/", "/advanced", "/how-it-works"])
  test(`${path} has one canonical URL, without the scenario`, async ({
    page,
  }) => {
    await page.goto(`${path}?c=USD&a=9000`);
    const links = page.locator('head link[rel="canonical"]');
    await expect(links).toHaveCount(1);
    expect(await links.getAttribute("href")).toBe(canonical(path));
  });

test("the 404 page claims no canonical URL and asks not to be indexed", async ({
  page,
}) => {
  await page.goto("/no-such-page");
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});

test("only the planner has JSON-LD, with exactly the agreed fields", async ({
  page,
}) => {
  const blocks = () =>
    page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
  await page.goto("/");
  const found = await blocks();
  expect(found).toHaveLength(1);
  expect(JSON.parse(found[0]!)).toEqual(WEB_APPLICATION);
  for (const path of ["/advanced", "/how-it-works", "/no-such-page"]) {
    await page.goto(path);
    expect(await blocks()).toEqual([]);
  }
});

test("/sitemap.xml lists the three pages, dated by the latest rates", async ({
  request,
}) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/xml/);
  const xml = await res.text();
  expect(xml).toMatch(/^<\?xml /);
  expect(xml).toContain(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  );
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  expect(locs).toEqual([SITE, `${SITE}/advanced`, `${SITE}/how-it-works`]);
  const dates = [...xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map(
    (m) => m[1],
  );
  expect(dates).toHaveLength(3);
  expect(new Set(dates).size).toBe(1);
  expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("/robots.txt allows every crawler and names the sitemap", async ({
  request,
}) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^text\/plain/);
  const text = await res.text();
  expect(text).not.toMatch(/<html/i);
  expect(text).toMatch(/^User-Agent: \*$/m);
  expect(text).toMatch(/^Allow: \/$/m);
  expect(text).not.toMatch(/^Disallow:/m);
  expect(text).toMatch(new RegExp(`^Sitemap: ${SITE}/sitemap.xml$`, "m"));
});
