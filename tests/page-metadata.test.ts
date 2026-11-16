// The link-preview image and tags, canonical URLs, titles, JSON-LD and the
// sitemap's pages. e2e/link-previews.spec.ts and e2e/seo.spec.ts check them
// as built, including that the URLs come out absolute.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import meta from "@/data/meta.json";
import { latestRateDate, PAGE_URLS } from "../lib/crawl.ts";
import { pageMetadata } from "../lib/page-metadata.ts";
import { SITE_URL, TITLES } from "../lib/site.ts";
import { jsonLd, WEB_APPLICATION } from "../lib/structured-data.ts";
import {
  BANNED_IN_UI_TEXT,
  comparesStrategies,
  namesRanking,
} from "./advisory-patterns.ts";

describe("public/og-image.png", () => {
  const png = readFileSync("public/og-image.png");

  it("is a PNG of 1200 x 630", () => {
    expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
    // Width and height are the first fields of the IHDR chunk.
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

describe("pageMetadata", () => {
  const page = { title: "A page", description: "About it", path: "/a" };
  const m = pageMetadata(page);

  it("gives the page's own title and description to every preview", () => {
    expect(m).toMatchObject({ title: "A page", description: "About it" });
    expect(m.openGraph).toMatchObject({
      title: "A page",
      description: "About it",
      url: "/a",
    });
    expect(m.twitter).toMatchObject({
      title: "A page",
      description: "About it",
      card: "summary_large_image",
    });
  });

  it("gives the page's path as its canonical URL", () => {
    expect(m.alternates).toEqual({ canonical: "/a" });
  });

  it("uses the one fixed image, with its size and alt text", () => {
    for (const images of [m.openGraph?.images, m.twitter?.images])
      expect(images).toEqual([
        expect.objectContaining({
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: expect.stringContaining("Historical data, not advice"),
        }),
      ]);
  });
});

describe("TITLES", () => {
  it.each(Object.values(TITLES))(
    "%s is short enough for search results and uses no advice wording",
    (title) => {
      expect(title.length).toBeLessThanOrEqual(60);
      expect(title).toContain("SpotCheck");
      for (const banned of BANNED_IN_UI_TEXT) expect(title).not.toMatch(banned);
      expect(namesRanking(title)).toBeUndefined();
      expect(comparesStrategies(title)).toBeUndefined();
    },
  );
});

describe("WEB_APPLICATION (JSON-LD)", () => {
  it("has only the agreed fields: no rating, review or other claim", () => {
    expect(WEB_APPLICATION).toEqual({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "SpotCheck",
      url: SITE_URL,
      description: expect.stringContaining("Historical data, not advice"),
      applicationCategory: "FinanceApplication",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "SGD" },
      inLanguage: "en",
    });
    for (const banned of BANNED_IN_UI_TEXT)
      expect(WEB_APPLICATION.description).not.toMatch(banned);
  });

  it("can't close its script element early", () => {
    const text = jsonLd({ a: "</script><script>x()</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({ a: "</script><script>x()</script>" });
  });
});

describe("sitemap pages", () => {
  it("lists each page once, at its canonical URL", () => {
    expect(PAGE_URLS).toEqual([
      SITE_URL,
      `${SITE_URL}/advanced`,
      `${SITE_URL}/how-it-works`,
    ]);
  });

  it("dates them by the latest rate in data/meta.json", () => {
    expect(
      latestRateDate({
        a: { last: "2026-11-13" },
        b: { last: "2026-11-16" },
        c: { last: "2026-10-30" },
      }),
    ).toBe("2026-11-16");
    expect(latestRateDate(meta.series)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(() => latestRateDate({})).toThrow();
  });
});
