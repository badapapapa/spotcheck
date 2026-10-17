// Copies data/ into public/data/ so the static site serves it. Runs before
// `next dev` and `next build`; public/data/ is gitignored.

import { cpSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const target = join(root, "public", "data");
rmSync(target, { recursive: true, force: true });
cpSync(join(root, "data"), target, { recursive: true });
console.log("Copied data/ → public/data/");
