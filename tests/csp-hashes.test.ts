// scripts/csp-hashes.ts: per-page script hashes in out/_headers, so no page
// allows 'unsafe-inline' scripts. e2e/csp.spec.ts checks the built site.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildHeaders,
  hashSource,
  inlineScripts,
  MAX_LINE,
  routesFor,
  withHashes,
} from "../scripts/csp-hashes.ts";
import { headersFor, parseHeaders } from "../scripts/headers.ts";

const TEMPLATE = readFileSync("public/_headers", "utf8");
const scriptSrc = (policy: string) =>
  policy
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith("script-src "))!;

describe("inlineScripts", () => {
  it("takes every script without a src, exactly as written", () => {
    const html =
      '<head><script src="/a.js"></script><script>one()</script></head>' +
      '<body><SCRIPT type="module">\n two()\n</SCRIPT><script async src=b.js></script>' +
      "<script></script></body>";
    expect(inlineScripts(html)).toEqual(["one()", "\n two()\n", ""]);
  });
});

describe("hashSource", () => {
  it("matches the CSP specification's own example", () => {
    // CSP Level 3, "hash-source": <script>alert('Hello, world.');</script>
    expect(hashSource("alert('Hello, world.');")).toBe(
      "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='",
    );
  });

  it("depends on every byte, whitespace included", () => {
    expect(hashSource("a()")).not.toBe(hashSource("a() "));
  });
});

describe("routesFor", () => {
  it("covers each page's clean URL and its .html form", () => {
    expect(routesFor("index.html")).toEqual(["/", "/index.html"]);
    expect(routesFor("advanced.html")).toEqual(["/advanced", "/advanced.html"]);
    expect(routesFor("404.html")).toEqual(["/404", "/404.html"]);
  });
});

describe("withHashes", () => {
  const policy = "default-src 'self'; script-src 'self' https://x.example";

  it("adds each hash once, to script-src only", () => {
    const out = withHashes(policy, ["'sha256-b'", "'sha256-a'", "'sha256-b'"]);
    expect(out).toBe(
      "default-src 'self'; script-src 'self' https://x.example 'sha256-a' 'sha256-b'",
    );
  });

  it("refuses a policy that already allows inline scripts", () => {
    expect(() =>
      withHashes("script-src 'self' 'unsafe-inline'", ["'sha256-a'"]),
    ).toThrow(/inline/);
    expect(() => withHashes("default-src 'self'", [])).toThrow(/script-src/);
  });
});

describe("buildHeaders", () => {
  const pages = [
    { file: "index.html", scripts: ["home()", "shared()"] },
    { file: "advanced.html", scripts: ["hedging()", "shared()"] },
    { file: "404.html", scripts: ["missing()"] },
  ];
  const text = buildHeaders(TEMPLATE, pages);
  const rules = parseHeaders(text);
  const csp = (path: string) =>
    headersFor(rules, path)["Content-Security-Policy"]!;

  it("gives every page route exactly one policy, with its own hashes", () => {
    for (const [paths, own, other] of [
      [["/", "/index.html"], ["home()", "shared()"], "hedging()"],
      [["/advanced", "/advanced.html"], ["hedging()", "shared()"], "home()"],
      [["/404", "/404.html"], ["missing()"], "home()"],
    ] as const)
      for (const path of paths) {
        const policy = csp(path);
        // One policy: two joined with ", " would both be enforced.
        expect(policy).not.toContain(", ");
        for (const s of own) expect(policy).toContain(hashSource(s));
        expect(policy).not.toContain(hashSource(other));
      }
  });

  it("serves unknown paths (the 404 page) with the 404 page's hashes", () => {
    const policy = csp("/no-such-page");
    expect(policy).toContain(hashSource("missing()"));
    expect(policy).not.toContain(hashSource("home()"));
  });

  it("never allows 'unsafe-inline' scripts; styles keep it", () => {
    for (const path of ["/", "/advanced.html", "/404", "/x", "/_next/a.js"]) {
      const policy = csp(path);
      expect(scriptSrc(policy)).not.toMatch(/'unsafe-inline'|'unsafe-hashes'/);
      expect(policy).toMatch(/style-src 'self' 'unsafe-inline'/);
    }
  });

  it("keeps the template's other headers and the beacon", () => {
    const h = headersFor(rules, "/advanced");
    expect(h["Strict-Transport-Security"]).toBe("max-age=31536000");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(scriptSrc(h["Content-Security-Policy"]!)).toContain(
      "https://static.cloudflareinsights.com",
    );
    expect(
      headersFor(rules, "/_next/static/chunks/a.js")["Cache-Control"],
    ).toBe("public, max-age=31536000, immutable");
  });

  it("stays within Cloudflare's limits, and fails loudly outside them", () => {
    expect(Math.max(...text.split("\n").map((l) => l.length))).toBeLessThan(
      MAX_LINE,
    );
    const many = Array.from({ length: 40 }, (_, i) => `s${i}()`);
    expect(() =>
      buildHeaders(TEMPLATE, [...pages, { file: "big.html", scripts: many }]),
    ).toThrow(/limit is 2000/);
  });

  it("refuses a template without one policy, or without a 404 page", () => {
    expect(() => buildHeaders("/*\n  X-A: b\n", pages)).toThrow(/one/);
    expect(() => buildHeaders(TEMPLATE, pages.slice(0, 2))).toThrow(/404/);
  });
});
