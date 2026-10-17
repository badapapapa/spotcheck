// Reading and writing the committed data files. Files are written with one
// observation per line so daily commits produce small, reviewable diffs.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { z } from "zod";

export const DATA_DIR = join(import.meta.dirname, "..", "..", "data");

export function readJson<T>(
  relPath: string,
  schema: z.ZodType<T>,
): T | undefined {
  const path = join(DATA_DIR, relPath);
  if (!existsSync(path)) return undefined;
  return schema.parse(JSON.parse(readFileSync(path, "utf8")));
}

/** JSON with every element of `rows` on its own line; other fields compact. */
export function stringifyDataFile(file: { rows: readonly unknown[] }): string {
  const { rows, ...header } = file;
  const head = JSON.stringify(header, null, 2).replace(/\n}$/, "");
  const body = rows.map((r) => "    " + JSON.stringify(r)).join(",\n");
  return `${head},\n  "rows": [\n${body}\n  ]\n}\n`;
}

/** Writes the file if its content changed. Returns true if it wrote. */
export function writeIfChanged(relPath: string, content: string): boolean {
  const path = join(DATA_DIR, relPath);
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return true;
}
