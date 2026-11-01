// Cloudflare Pages reads public/_headers. The security headers apply to
// every path; hashed build assets are cached for a year.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { headersFor, parseHeaders } from "../scripts/headers.ts";

const rules = parseHeaders(readFileSync("public/_headers", "utf8"));

describe("public/_headers", () => {
  it("caches hashed /_next/static files for a year, immutably", () => {
    expect(
      headersFor(rules, "/_next/static/chunks/0b7kjytw_6y81.js")[
        "Cache-Control"
      ],
    ).toBe("public, max-age=31536000, immutable");
  });

  it("never marks pages or data immutable (they change every day)", () => {
    for (const path of ["/", "/advanced", "/data/fx/SGD-USD.json"])
      expect(headersFor(rules, path)["Cache-Control"]).toBeUndefined();
  });

  it("keeps the security headers on every path, without 'unsafe-eval'", () => {
    for (const path of ["/", "/_next/static/x.js", "/data/meta.json"]) {
      const h = headersFor(rules, path);
      expect(h["Content-Security-Policy"]).toMatch(/default-src 'self'/);
      expect(h["Content-Security-Policy"]).not.toMatch(/unsafe-eval/);
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["X-Content-Type-Options"]).toBe("nosniff");
    }
  });
});
