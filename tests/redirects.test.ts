// Cloudflare Pages reads public/_redirects. The Hedging tab's route is
// /advanced (old shared links use it); /hedging must lead there too.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rules = readFileSync("public/_redirects", "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => l.split(/\s+/));

describe("public/_redirects", () => {
  it("sends /hedging (with or without a slash) to /advanced, permanently", () => {
    for (const from of ["/hedging", "/hedging/"])
      expect(rules).toContainEqual([from, "/advanced", "301"]);
  });

  it("never redirects /advanced itself, so old shared links keep working", () => {
    expect(rules.some(([from]) => from?.startsWith("/advanced"))).toBe(false);
  });
});
