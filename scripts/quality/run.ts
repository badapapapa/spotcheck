// The nightly data-quality check (`npm run quality`), run by the build job
// of fetch-data.yml after the fetch. It reads the rates and never changes
// them; it writes data/quality.json (the open flags) and, in GitHub
// Actions, a summary of what it judged. Severe flags (unit errors,
// inversions) exit 1, which fails the job: nothing is committed and
// yesterday's data stays live. docs/quality/flag-handling.md has the rules.
//
// Which days it judges: the week up to the last check again, then every
// day after it. Series publish on different days (the ECB a day after the
// blended rates), and a day judged again once its next day is known can be
// confirmed as a spike. Re-judging may add or upgrade a flag, never remove
// or downgrade an open one. With no earlier check, the last 30 days.

import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import {
  QualityFileSchema,
  type QualityFile,
  type QualityFlag,
} from "../../lib/quality.ts";
import { DATA_DIR } from "../fetch/io.ts";
import { KNOWN_ANOMALIES } from "../fetch/known-anomalies.ts";
import type { KnownAnomaly } from "../fetch/schemas.ts";
import {
  allFeatures,
  fitOn,
  flagDay,
  PROPOSED,
  type Flag,
  type Thresholds,
} from "./detect.ts";
import type { DayFeatures } from "./features.ts";
import type { Forest } from "./iforest.ts";
import { loadSeries } from "./load.ts";

/** Days judged on a first run, counted back from the latest rate. */
export const FIRST_RUN_DAYS = 30;
/** Days before the last check judged again. */
export const RECHECK_DAYS = 7;

/** `date` minus `days` calendar days (UTC, ISO strings only). */
export function daysBefore(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

const toRecord = (f: Flag): QualityFlag => ({
  currency: f.code,
  date: f.date,
  kind: f.kind,
  severity: f.severity,
  move: f.move,
  z: f.z,
  peerZ: f.peerZ,
  score: f.score,
});

export type NightlyResult = {
  file: QualityFile;
  /** The first day judged this run. */
  from: string;
  /** Flags raised this run (reviewed days excluded), with their reasons. */
  raised: Flag[];
  severe: Flag[];
};

/**
 * One night's check. `prev` is the last data/quality.json, if any; a flag
 * stays open until its day is added to known-anomalies.ts (no expiry).
 */
export function nightly(
  all: Map<string, DayFeatures[]>,
  prev: QualityFile | undefined,
  {
    known = KNOWN_ANOMALIES,
    thresholds = PROPOSED,
    forest,
  }: {
    known?: readonly KnownAnomaly[];
    thresholds?: Thresholds;
    forest?: Forest;
  } = {},
): NightlyResult {
  const latest = [...all.values()]
    .map((d) => d.at(-1)?.date ?? "")
    .reduce((a, b) => (b > a ? b : a), "");
  const from = prev
    ? daysBefore(prev.checkedThrough, RECHECK_DAYS)
    : daysBefore(latest, FIRST_RUN_DAYS);
  const reviewed = (currency: string, date: string) =>
    known.some((a) => a.series === `SGD-${currency}` && a.date === date);

  const raised: Flag[] = [];
  for (const [code, days] of all)
    days.forEach((d, i) => {
      if (d.date < from) return;
      const flag = flagDay(code, days, i, thresholds, forest);
      if (flag && !reviewed(code, flag.date)) raised.push(flag);
    });

  // Earlier open flags, then this run's. Re-judging may add a flag or
  // upgrade one (soft to severe, or the same severity with the latest view
  // of the day), but never removes or downgrades an open flag: a day that
  // looks fine once its next day is in stays open until it is reviewed.
  const rank = (f: QualityFlag) => (f.severity === "severe" ? 1 : 0);
  const open = new Map<string, QualityFlag>();
  for (const f of prev?.open ?? [])
    if (!reviewed(f.currency, f.date)) open.set(`${f.currency} ${f.date}`, f);
  for (const f of raised) {
    const key = `${f.code} ${f.date}`;
    const next = toRecord(f);
    const before = open.get(key);
    if (!before || rank(next) >= rank(before)) open.set(key, next);
  }

  return {
    file: {
      checkedThrough: latest,
      open: [...open.values()].sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.currency.localeCompare(b.currency),
      ),
    },
    from,
    raised,
    severe: raised.filter((f) => f.severity === "severe"),
  };
}

/** The GitHub job summary, in Markdown. */
export function summary(r: NightlyResult): string {
  const lines = [
    "## Data-quality check",
    "",
    `Judged ${r.from} to ${r.file.checkedThrough}: ${r.raised.length} new flag(s), ${r.file.open.length} open.`,
  ];
  if (r.severe.length)
    lines.push(
      "",
      `**${r.severe.length} severe flag(s): the job fails and nothing is committed.**`,
    );
  if (r.raised.length)
    lines.push(
      "",
      "| Currency | Date | Kind | Severity | Why |",
      "|---|---|---|---|---|",
      ...r.raised.map(
        (f) =>
          `| ${f.code} | ${f.date} | ${f.kind} | ${f.severity} | ${f.why} |`,
      ),
    );
  return lines.join("\n") + "\n";
}

if (import.meta.main) {
  const path = join(DATA_DIR, "quality.json");
  const prev = existsSync(path)
    ? QualityFileSchema.parse(JSON.parse(readFileSync(path, "utf8")))
    : undefined;
  const all = allFeatures(loadSeries());
  const result = nightly(all, prev, { forest: fitOn(all) });
  writeFileSync(path, JSON.stringify(result.file, null, 2) + "\n");
  const text = summary(result);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  console.log(text);
  if (result.severe.length) process.exit(1);
}
