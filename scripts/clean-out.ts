// After `next build`: removes two files the static export ships but nothing
// loads. Turbopack runs the compute worker from its own bundled chunk, yet
// also copies lib/compute.worker.ts, as TypeScript source, into
// _next/static/media; and it writes source maps with no sources.

import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "..", "out", "_next", "static");
const removed: string[] = [];
for (const entry of readdirSync(OUT, {
  recursive: true,
  withFileTypes: true,
})) {
  if (!entry.isFile()) continue;
  const path = join(entry.parentPath, entry.name);
  const emptyMap =
    entry.name.endsWith(".map") &&
    (JSON.parse(readFileSync(path, "utf8")) as { sources?: unknown[] }).sources
      ?.length === 0;
  if (entry.name.endsWith(".ts") || emptyMap) {
    rmSync(path);
    removed.push(path.slice(OUT.length + 1));
  }
}
console.log(
  `clean-out: removed ${removed.length} unused file(s): ${removed.join(", ")}`,
);
