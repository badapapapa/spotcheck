// Strict parsing for the typed number fields (amount, spread, target,
// conversions, volatility). They are text inputs, not type="number": a
// browser number field reads "15.000" or "0,5" by its own locale rules and
// hands back a different number without saying so. Here only the English
// style is accepted (a dot for decimals; commas or spaces between groups of
// three digits), and anything that could be read two ways gets a specific
// message instead of a guess.

export type ParsedNumber =
  | { ok: true; value: number }
  | { ok: false; reason: "empty" | "invalid" | "ambiguous"; message?: string };

const SPACES = /[   ]/g;
// Plain: "15000", "0.5", ".5", "5." (a trailing dot while typing).
const PLAIN = /^(\d+(\.\d*)?|\.\d+)$/;
// Grouped in threes with one kind of separator: "15,000", "1,500,000.50",
// "15 000" (also no-break and thin spaces).
const GROUPED = /^\d{1,3}([,   ])\d{3}(\1\d{3})*(\.\d*)?$/;

export const MESSAGES = {
  otherDigits: "Use the digits 0–9.",
  decimalComma: "Use a dot for decimals, e.g. 0.5.",
  dotThousands: "Write thousands without dots, e.g. 15000 or 15,000.",
  mixed: "Use a dot for decimals and commas for thousands, e.g. 1,500.50.",
} as const;

export function parseNumberText(raw: string): ParsedNumber {
  const text = raw.trim();
  if (text === "") return { ok: false, reason: "empty" };
  // Digits from other scripts (Arabic-Indic, full-width…) are real digits,
  // but this form only reads 0–9: say so rather than call them invalid.
  if (/[^\P{Nd}0-9]/u.test(text))
    return { ok: false, reason: "invalid", message: MESSAGES.otherDigits };
  // European forms first, because "15.000" also looks like a plain decimal.
  // "1.500,50": dots between thousands and a decimal comma.
  if (/^\d{1,3}(\.\d{3})+,\d*$/.test(text))
    return { ok: false, reason: "ambiguous", message: MESSAGES.mixed };
  // "15.000", "1.500.000": fifteen thousand in German, fifteen in English.
  if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(text))
    return { ok: false, reason: "ambiguous", message: MESSAGES.dotThousands };
  if (PLAIN.test(text)) return { ok: true, value: Number(text) };
  if (GROUPED.test(text))
    return {
      ok: true,
      value: Number(text.replace(/,/g, "").replace(SPACES, "")),
    };
  // "0,5", "15,5", "15,50", "1,5000": a decimal comma (not groups of three).
  if (/^\d+,\d+$/.test(text))
    return { ok: false, reason: "ambiguous", message: MESSAGES.decimalComma };
  return { ok: false, reason: "invalid" };
}

/**
 * Parses `raw` and checks it against [min, max] (and whole numbers when
 * `integer`). Errors always state the real limits (`range`, e.g.
 * "Enter 1–100%."), unless the text needs a more specific message.
 */
export function readNumberField(
  raw: string,
  opts: { min: number; max: number; integer?: boolean; range: string },
): { ok: true; value: number } | { ok: false; message: string } {
  const p = parseNumberText(raw);
  if (!p.ok) return { ok: false, message: p.message ?? opts.range };
  const { value } = p;
  if (
    !Number.isFinite(value) ||
    value < opts.min ||
    value > opts.max ||
    (opts.integer === true && !Number.isInteger(value))
  )
    return { ok: false, message: opts.range };
  return { ok: true, value };
}

/** 15000 → "15,000"; 0.5 → "0.5" (en grouping, no trailing zeros). */
export function formatNumberText(value: number): string {
  return value.toLocaleString("en-SG", { maximumFractionDigits: 6 });
}
