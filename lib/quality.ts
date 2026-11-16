// data/quality.json: the nightly data-quality check's open flags
// (scripts/quality/run.ts writes it; docs/quality/flag-handling.md says how
// flags are handled). Numbers and fixed values only, no free text, so every
// field can be checked: here with Zod, and with jq before it reaches an issue.

// Zod only, so the scripts (run directly by Node) can use it too.

import { z } from "zod";

// See scripts/fetch/schemas.ts: no eval probe under the site's CSP.
z.config({ jitless: true });

export const FLAG_KINDS = [
  "unit",
  "inverted",
  "spike",
  "move",
  "stale",
  "outlier",
] as const;

const score = z.number().finite().nullable();

export const QualityFlagSchema = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    date: z.iso.date(),
    kind: z.enum(FLAG_KINDS),
    severity: z.enum(["severe", "soft"]),
    /** The day's move as a fraction (−0.095 = −9.5%). */
    move: z.number().finite(),
    z: score,
    peerZ: score,
    /** The isolation forest's score, for an outlier flag. */
    score,
  })
  .strict();

export const QualityFileSchema = z
  .object({
    /** The latest day the check has judged. */
    checkedThrough: z.iso.date(),
    /** Flags not yet reviewed (scripts/fetch/known-anomalies.ts closes them). */
    open: z.array(QualityFlagSchema),
  })
  .strict();

export type QualityFlag = z.infer<typeof QualityFlagSchema>;
export type QualityFile = z.infer<typeof QualityFileSchema>;
