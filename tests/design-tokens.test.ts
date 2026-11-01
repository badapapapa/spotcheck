import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guard for DESIGN.md: components take type sizes and colours from the
// tokens in app/globals.css (and chart styling from lib/chart-style.ts),
// never from one-off values, so the scale can't drift again.

function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsx(path);
    return name.endsWith(".tsx") ? [path] : [];
  });
}

const RULES: [string, RegExp][] = [
  // e.g. text-[15px]: use text-ui, text-sm, t-small …
  ["an arbitrary font size", /\btext-\[\d+(\.\d+)?(px|rem)\]/],
  // Tailwind's default sizes are cleared in @theme; these would do nothing.
  ["a size outside the scale", /\btext-(xs|lg|xl|[2-9]xl)\b/],
  // Chart text comes from lib/chart-style.ts.
  ["an inline font size", /\bfontSize\s*:/],
  // Colours are tokens (var(--…)), in both themes.
  ["a raw hex colour", /#[0-9a-fA-F]{6}\b/],
];

/**
 * The browser's theme-color meta tag (app/layout.tsx) can't read CSS
 * variables, so it repeats --paper's two values as hex. Nothing else may.
 */
const exempt = (line: string) =>
  /media: "\(prefers-color-scheme: (light|dark)\)", color: "#/.test(line);

describe("design tokens", () => {
  const files = tsx("app");

  it("scans the components", () => {
    expect(files).toContain(join("app", "components", "Planner.tsx"));
    expect(files).toContain(join("app", "components", "ChartLegend.tsx"));
  });

  it.each(files)("%s uses only tokens", (file) => {
    const lines = readFileSync(file, "utf8").split("\n");
    const found = lines.flatMap((line, i) =>
      RULES.filter(([, re]) => re.test(line) && !exempt(line)).map(
        ([what]) => `${file}:${i + 1} ${what}`,
      ),
    );
    expect(found).toEqual([]);
  });
});
