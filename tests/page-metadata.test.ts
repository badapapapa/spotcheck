// The link-preview image and tags. e2e/link-previews.spec.ts checks the tags
// as built, including that the URLs come out absolute.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pageMetadata } from "../lib/page-metadata.ts";

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
