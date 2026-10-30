import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "@/lib/site";
import { BANNED_IN_SOURCE as BANNED } from "./advisory-patterns.ts";

// Guard for the no-financial-advice rule: user-facing source must never use
// advisory wording. This scans the UI folders, not the engine, whose comments
// may legitimately discuss e.g. "best execution" in a technical sense.
const UI_DIRS = ["app", "components", "lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|md|mdx)$/.test(name) && !name.endsWith(".test.ts")
      ? [path]
      : [];
  });
}

describe("advisory wording", () => {
  // components/ held the shadcn primitives; it may be empty or gone.
  const files = UI_DIRS.filter((d) => existsSync(d)).flatMap(sourceFiles);

  it("scans at least the layout and home page", () => {
    expect(files).toContain(join("app", "layout.tsx"));
    expect(files).toContain(join("app", "page.tsx"));
    // The redesign's comparison table and hedging rows.
    expect(files).toContain(join("app", "components", "ComparisonTable.tsx"));
    expect(files).toContain(join("app", "components", "ValueRows.tsx"));
    expect(files).toContain(join("app", "components", "HelpTip.tsx"));
    // The redesign's result, strategy guide and How it works page.
    expect(files).toContain(join("app", "components", "Result.tsx"));
    expect(files).toContain(join("app", "components", "StrategyGuide.tsx"));
    expect(files).toContain(join("app", "how-it-works", "page.tsx"));
  });

  it.each(files)("%s contains no advisory wording", (file) => {
    const text = readFileSync(file, "utf8");
    for (const pattern of BANNED) {
      expect(text, `${file} matches ${pattern}`).not.toMatch(pattern);
    }
  });

  it("disclaimer states it is not financial advice", () => {
    expect(DISCLAIMER).toContain("Not financial advice");
  });
});
