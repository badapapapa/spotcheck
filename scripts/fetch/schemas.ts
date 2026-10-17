// Shapes of the committed data files, plus the sanity checks every file must
// pass before the daily job commits it. The site re-uses the Zod schemas to
// check each file it downloads before using it.
//
// No relative imports here, so both Node (scripts) and Next.js (app) can load
// this file.

import { z } from "zod";

const isoDate = z.iso.date(); // 'YYYY-MM-DD'
const positive = z.number().finite().positive();
const decimalRate = z.number().finite();

/** One FX observation: [date, Frankfurter rate (foreign per 1 SGD), SGD per 1 foreign unit]. */
export const FxRowSchema = z.tuple([isoDate, positive, positive]);

export const FxFileSchema = z.object({
  kind: z.literal("fx"),
  quote: z.string().regex(/^[A-Z]{3}$/),
  unit: z.string(),
  source: z.string(),
  note: z.string().optional(),
  rows: z.array(FxRowSchema).min(1),
});

/** One SORA observation: [value date, publication date, SORA, compounded 1M, 3M, 6M], all decimals. */
export const SoraRowSchema = z.tuple([
  isoDate,
  isoDate,
  decimalRate,
  decimalRate.nullable(),
  decimalRate.nullable(),
  decimalRate.nullable(),
]);

export const SoraFileSchema = z.object({
  kind: z.literal("sora"),
  unit: z.string(),
  source: z.string(),
  rows: z.array(SoraRowSchema).min(1),
});

/** One overnight-rate observation: [date, rate as a decimal]. */
export const RateRowSchema = z.tuple([isoDate, decimalRate]);

export const RateFileSchema = z.object({
  kind: z.literal("rate"),
  series: z.string(),
  unit: z.string(),
  source: z.string(),
  rows: z.array(RateRowSchema).min(1),
});

export const MetaFileSchema = z.object({
  series: z.record(
    z.string(),
    z.object({ first: isoDate, last: isoDate, count: z.number().int() }),
  ),
  attribution: z.array(z.object({ name: z.string(), url: z.url() })),
});

export type FxRow = z.infer<typeof FxRowSchema>;
export type FxFile = z.infer<typeof FxFileSchema>;
export type SoraRow = z.infer<typeof SoraRowSchema>;
export type SoraFile = z.infer<typeof SoraFileSchema>;
export type RateRow = z.infer<typeof RateRowSchema>;
export type RateFile = z.infer<typeof RateFileSchema>;
export type MetaFile = z.infer<typeof MetaFileSchema>;

// ---------------------------------------------------------------------------
// Sanity checks

/** A reviewed exception to the sanity checks, e.g. a real devaluation. */
export type KnownAnomaly = {
  series: string;
  date: string; // date of the observation that trips the check
  kind: "gap" | "jump";
  note: string;
};

export type CheckResult = { errors: string[]; warnings: string[] };

export const LIMITS = {
  /** Calendar days between observations that is an error. */
  maxGapDays: 7,
  /** Calendar days between observations that is logged as a warning. */
  warnGapDays: 4,
  /** Largest allowed day-on-day FX move, as a fraction. */
  maxFxJump: 0.3,
  /** Interest rates must lie in [-1%, 25%]. */
  minRate: -0.01,
  maxRate: 0.25,
} as const;

function daysBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}

function isAllowed(
  allow: readonly KnownAnomaly[],
  series: string,
  date: string,
  kind: KnownAnomaly["kind"],
): boolean {
  return allow.some(
    (a) => a.series === series && a.date === date && a.kind === kind,
  );
}

/**
 * Checks shared by every series: dates strictly ascending and no long gaps.
 * `dates[i]` must be ISO strings (already checked by the Zod schema).
 */
export function checkDates(
  series: string,
  dates: readonly string[],
  allow: readonly KnownAnomaly[] = [],
): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (let i = 1; i < dates.length; i++) {
    const prev = dates[i - 1]!;
    const cur = dates[i]!;
    const gap = daysBetween(prev, cur);
    if (gap <= 0) {
      errors.push(
        `${series}: dates not strictly ascending at ${prev} → ${cur}`,
      );
    } else if (gap > LIMITS.maxGapDays) {
      if (!isAllowed(allow, series, cur, "gap")) {
        errors.push(`${series}: ${gap}-day gap from ${prev} to ${cur}`);
      }
    } else if (gap > LIMITS.warnGapDays) {
      warnings.push(`${series}: ${gap}-day gap from ${prev} to ${cur}`);
    }
  }
  return { errors, warnings };
}

export function checkFx(
  file: FxFile,
  allow: readonly KnownAnomaly[] = [],
  { allowRepeats = false } = {},
): CheckResult {
  const series = `SGD-${file.quote}`;
  const result = checkDates(
    series,
    file.rows.map((r) => r[0]),
    allow,
  );
  for (let i = 0; i < file.rows.length; i++) {
    const [date, raw, sgdPerUnit] = file.rows[i]!;
    // The stored inversion must agree with the raw rate (to rounding).
    if (Math.abs(raw * sgdPerUnit - 1) > 1e-6) {
      result.errors.push(`${series}: ${date} inversion mismatch`);
    }
    // Only real trading observations: no weekend rows, no carried-forward
    // repeats (except for a pegged series, which repeats by design).
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) {
      result.errors.push(`${series}: weekend row on ${date}`);
    }
    if (i === 0) continue;
    if (!allowRepeats && raw === file.rows[i - 1]![1]) {
      result.errors.push(
        `${series}: ${date} repeats the previous rate (carried forward)`,
      );
    }
    const prev = file.rows[i - 1]![2];
    const move = Math.abs(sgdPerUnit / prev - 1);
    if (move > LIMITS.maxFxJump && !isAllowed(allow, series, date, "jump")) {
      result.errors.push(
        `${series}: ${(move * 100).toFixed(1)}% move on ${date}`,
      );
    }
  }
  return result;
}

function checkRateValue(
  series: string,
  date: string,
  value: number,
  errors: string[],
): void {
  if (value < LIMITS.minRate || value > LIMITS.maxRate) {
    errors.push(`${series}: rate ${value} on ${date} outside [-1%, 25%]`);
  }
}

export function checkSora(
  file: SoraFile,
  allow: readonly KnownAnomaly[] = [],
): CheckResult {
  const result = checkDates(
    "SORA",
    file.rows.map((r) => r[0]),
    allow,
  );
  for (const [date, , ...values] of file.rows) {
    for (const v of values) {
      if (v !== null) checkRateValue("SORA", date, v, result.errors);
    }
  }
  return result;
}

export function checkRate(
  file: RateFile,
  allow: readonly KnownAnomaly[] = [],
): CheckResult {
  const result = checkDates(
    file.series,
    file.rows.map((r) => r[0]),
    allow,
  );
  for (const [date, value] of file.rows) {
    checkRateValue(file.series, date, value, result.errors);
  }
  return result;
}
