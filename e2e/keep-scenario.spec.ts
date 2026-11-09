import { expect, type Locator, type Page, test } from "@playwright/test";

// Until React takes over, internal links are plain links with no query
// (lib/keep-scenario.ts). These tests stop the page's JavaScript from ever
// running, so that state is held open instead of being a race: following a
// link there must still carry the scenario. No test here depends on timing.

const Q = "c=USD&a=9000&s=2026-10-17&d=2027-06-01&k=3&sp=0.5&t=2";
// .js only: the stylesheets live under the same path, and without them both
// navs would be on screen at once.
const CHUNKS = /\/_next\/static\/chunks\/.*\.js(\?|$)/;

/** Opens `path` with its scripts blocked; the next page loads normally. */
async function openBeforeReact(page: Page, path: string) {
  let blocked = true;
  await page.route(CHUNKS, (r) => (blocked ? r.abort() : r.continue()));
  await page.goto(path);
  // Every chunk has been refused by now, so nothing can hydrate this page.
  blocked = false;
}

const home = (page: Page) =>
  page.locator("header").getByRole("link", { name: "SpotCheck" });
const hedging = (page: Page) =>
  page.getByRole("link", { name: "Hedging (USD)" });

/** The query of the URL a link was followed to. */
const queryOf = (url: string) => new URL(url).search.slice(1);

async function expectFollowedWithScenario(url: string, path: string) {
  expect(new URL(url).pathname).toBe(path);
  expect(new URLSearchParams(queryOf(url)).toString()).toBe(Q);
}

type Follow = (page: Page, link: Locator) => Promise<string>;

/** Follows the link in this tab; resolves with the URL it requested. */
const inThisTab = (act: (link: Locator) => Promise<void>): Follow =>
  async function (page, link) {
    const request = page.waitForRequest((r) => r.isNavigationRequest());
    await act(link);
    return (await request).url();
  };

/** Follows the link into a new tab; this page must stay as it was. */
const inNewTab = (act: (link: Locator) => Promise<void>): Follow =>
  async function (page, link) {
    const bare = await link.getAttribute("href");
    const opened = page.context().waitForEvent("page");
    await act(link);
    const tab = await opened;
    await tab.waitForURL(/\?/);
    const url = tab.url();
    await tab.close();
    await expect(link).toHaveAttribute("href", bare!);
    return url;
  };

const INPUTS: { name: string; follow: Follow; mouseOrKeys: boolean }[] = [
  {
    name: "a click",
    follow: inThisTab((link) => link.click()),
    mouseOrKeys: false,
  },
  {
    name: "Enter on the focused link",
    follow: inThisTab(async (link) => {
      await link.focus();
      await link.press("Enter");
    }),
    mouseOrKeys: true,
  },
  {
    name: "Cmd/Ctrl-click",
    follow: inNewTab((link) => link.click({ modifiers: ["ControlOrMeta"] })),
    mouseOrKeys: true,
  },
  {
    name: "a middle-click",
    follow: inNewTab((link) => link.click({ button: "middle" })),
    mouseOrKeys: true,
  },
];

const LINKS = [
  {
    name: "the tab",
    from: `/?${Q}`,
    link: hedging,
    to: "/advanced",
  },
  {
    name: "a ScenarioLink",
    from: `/advanced?${Q}`,
    link: home,
    to: "/",
  },
];

const WIDTHS = [
  { label: "desktop", viewport: { width: 1440, height: 900 } },
  { label: "375px", viewport: { width: 375, height: 812 } },
];

for (const { label, viewport } of WIDTHS) {
  test.describe(`before React takes over, at ${label}`, () => {
    test.use({ viewport });
    test.beforeEach(({ isMobile }) => {
      test.skip(label === "desktop" && isMobile, "phones are narrow");
    });

    for (const { name: linkName, from, link, to } of LINKS) {
      for (const { name, follow, mouseOrKeys } of INPUTS) {
        test(`${linkName} keeps the scenario on ${name}`, async ({
          page,
          isMobile,
        }) => {
          test.skip(isMobile && mouseOrKeys, "needs a mouse or keyboard");
          await openBeforeReact(page, from);
          // Proves the state under test: the link is still bare.
          await expect(link(page)).toHaveAttribute("href", to);
          await expectFollowedWithScenario(await follow(page, link(page)), to);
        });
      }
    }

    // The real tabs, streamed into the static HTML, rather than the fallback.
    test("a tab on How it works keeps the scenario", async ({ page }) => {
      await openBeforeReact(page, `/how-it-works?${Q}`);
      await expect(hedging(page)).toHaveAttribute("href", "/advanced");
      await expectFollowedWithScenario(
        await inThisTab((link) => link.click())(page, hedging(page)),
        "/advanced",
      );
    });

    test("the plan is there on arrival", async ({ page }) => {
      await openBeforeReact(page, `/?${Q}`);
      await hedging(page).click();
      await expect(page.getByLabel("Amount needed (USD)")).toHaveValue("9,000");
    });

    test("only the scenario's own parameters are carried", async ({ page }) => {
      await openBeforeReact(
        page,
        `/advanced?${Q}&from=JPY.500000&utm_source=x`,
      );
      await expectFollowedWithScenario(
        await inThisTab((link) => link.click())(page, home(page)),
        "/",
      );
    });

    test("a page with no scenario leaves the link as it is", async ({
      page,
    }) => {
      await openBeforeReact(page, "/?utm_source=x");
      const url = await inThisTab((link) => link.click())(page, hedging(page));
      expect(url).toMatch(/\/advanced$/);
    });
  });
}

test("once React has taken over, the links are left to it", async ({
  page,
}) => {
  await page.goto(`/?${Q}`);
  await expect(hedging(page)).toHaveAttribute("href", /a=9000/);
  // A full page load would mean something other than Next followed the link.
  const documents: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "document") documents.push(r.url());
  });
  await hedging(page).click();
  await expect(page.getByLabel("Amount needed (USD)")).toHaveValue("9,000");
  expect(documents).toEqual([]);
});
