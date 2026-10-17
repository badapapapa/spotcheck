import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// engine/ must stay pure TypeScript: no React, no network, no clock, no
// randomness, no local-time getters. All inputs are passed in.
const ENGINE = join(import.meta.dirname, "..");
const files = readdirSync(ENGINE).filter((f) => f.endsWith(".ts"));

const FORBIDDEN: [RegExp, string][] = [
  [/from ["']react/, "React"],
  [/\bfetch\s*\(/, "network"],
  [/XMLHttpRequest|WebSocket/, "network"],
  [/Date\.now\s*\(/, "clock"],
  [/new Date\(\s*\)/, "clock"],
  [/performance\.now/, "clock"],
  [/Math\.random/, "randomness"],
  [/\.get(FullYear|Month|Date|Day|Hours|Minutes)\s*\(/, "local-time getter"],
  [/from ["']node:/, "Node APIs"],
];

describe("engine purity", () => {
  it("has engine modules to check", () => {
    expect(files).toContain("strategies.ts");
  });

  it.each(files)("%s uses no React, network, clock or randomness", (file) => {
    const src = readFileSync(join(ENGINE, file), "utf8");
    for (const [pattern, what] of FORBIDDEN) {
      expect(src, `${file} uses ${what}`).not.toMatch(pattern);
    }
  });
});
