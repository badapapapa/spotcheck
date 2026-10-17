// Validation of the data files: Zod shape checks plus sanity checks.
// `checkAll` is used by run.ts before writing; running this file directly
// (`npm run validate-data`) checks what is committed.

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CURRENCIES, fxFileName } from "../../engine/currencies.ts";
import { DATA_DIR, readJson } from "./io.ts";
import { KNOWN_ANOMALIES } from "./known-anomalies.ts";
import { FX_SOURCES } from "./sources.ts";
import {
  FxFileSchema,
  MetaFileSchema,
  RateFileSchema,
  SoraFileSchema,
  checkFx,
  checkRate,
  checkSora,
  type CheckResult,
  type FxFile,
  type RateFile,
  type SoraFile,
} from "./schemas.ts";

export type DataFiles = {
  fx: Map<string, FxFile>;
  sora: SoraFile | undefined;
  rates: Map<string, RateFile>;
};

export function checkAll(files: DataFiles): CheckResult {
  const result: CheckResult = { errors: [], warnings: [] };
  const add = (r: CheckResult) => {
    result.errors.push(...r.errors);
    result.warnings.push(...r.warnings);
  };
  for (const c of CURRENCIES) {
    const file = files.fx.get(c.code);
    if (!file) result.errors.push(`SGD-${c.code}: missing`);
    else {
      add(
        checkFx(file, KNOWN_ANOMALIES, {
          // Only the blended feed carries rates forward; ECB repeats are real.
          allowRepeats: c.fxSource !== "blended",
        }),
      );
      if (file.source !== FX_SOURCES[c.fxSource]) {
        result.errors.push(
          `SGD-${c.code}: source doesn't match engine/currencies.ts (${c.fxSource})`,
        );
      }
    }
  }
  if (!files.sora) result.errors.push("SORA: missing");
  else add(checkSora(files.sora, KNOWN_ANOMALIES));
  const dff = files.rates.get("USD-DFF");
  if (!dff) result.errors.push("USD-DFF: missing");
  else add(checkRate(dff, KNOWN_ANOMALIES));
  return result;
}

function loadCommitted(): DataFiles {
  const fx = new Map<string, FxFile>();
  for (const name of readdirSync(join(DATA_DIR, "fx"))) {
    const file = readJson(`fx/${name}`, FxFileSchema);
    if (file) {
      if (fxFileName(file.quote) !== `fx/${name}`) {
        throw new Error(`fx/${name} holds ${file.quote}`);
      }
      fx.set(file.quote, file);
    }
  }
  const rates = new Map<string, RateFile>();
  const dff = readJson("rates/USD-DFF.json", RateFileSchema);
  if (dff) rates.set(dff.series, dff);
  return { fx, sora: readJson("rates/SORA.json", SoraFileSchema), rates };
}

// import.meta.main arrived in Node 24.2. On older versions it is undefined,
// which would skip validation and exit 0, so refuse to run instead.
if (import.meta.main === undefined) {
  throw new Error("validate.ts needs Node 24.2 or later (import.meta.main)");
}

if (import.meta.main) {
  const files = loadCommitted();
  readJson("meta.json", MetaFileSchema);
  const { errors, warnings } = checkAll(files);
  console.log(
    `Checked ${files.fx.size} FX files, SORA and ${files.rates.size} rate file(s): ` +
      `${errors.length} errors, ${warnings.length} warnings.`,
  );
  for (const e of errors) console.error(`  ERROR: ${e}`);
  if (errors.length) process.exit(1);
}
