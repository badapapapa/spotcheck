// Wording SpotCheck must never use (CLAUDE.md rule 3: no financial advice).
// Kept outside the scanned UI folders, since the patterns themselves contain
// the words. Never loosen these to fit new copy; change the copy instead.

/** Advisory phrases: banned in source files (comments included) and UI text. */
export const BANNED_IN_SOURCE: RegExp[] = [
  /\bbest\b/i,
  /\brecommend(s|ed|ation|ations)?\b/i,
  /\byou should\b/i,
  /\bbuy now\b/i,
  /\bsell now\b/i,
  /\bguarantee(d|s)?\b/i,
  /\boptimal\b/i,
  /\bwinners?\b/i,
  /\bconsider converting\b/i,
];

/**
 * For text a user actually sees: stricter. No "should" in any form, and no
 * predictive language about rates ("will", "likely to", "expect").
 */
export const BANNED_IN_UI_TEXT: RegExp[] = [
  ...BANNED_IN_SOURCE,
  /\bshould\b/i,
  /recommend/i,
  /\bwill\b/i,
  /\blikely to\b/i,
  /\bexpect(s|ed|ing)?\b/i,
];

/** The four strategies' names as the UI shows them. */
export const STRATEGY_NAMES = [
  "All at once",
  "Equal tranches",
  "Wait until deadline",
  "Target rate",
];

const RANK =
  "(lowest|highest|cheapest|dearest|best|worst|top|bottom|first|last|least|most|smallest|largest|narrowest|widest|lower|higher|cheaper)";

/**
 * Sentences that name a strategy as coming top or bottom on a measure:
 * "Target rate had the lowest median", "the cheapest strategy was Equal
 * tranches", "Equal tranches came first". Figures in a table are fine;
 * a verdict sentence is not. Returns the offending match, if any.
 */
export function namesRanking(text: string): string | undefined {
  // One sentence at a time, so a match can't span two.
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    for (const name of [
      ...STRATEGY_NAMES,
      "converting all at once",
      "waiting",
      "equal tranches",
      "a target rate",
    ]) {
      const n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const after = new RegExp(
        `\\b${n}\\b[^.]{0,40}?\\b(had|has|was|is|came|ranked|performed|did|scored)\\b[^.]{0,12}?\\b(the\\s+)?${RANK.replace("|lower|higher|cheaper", "")}\\b`,
        "i",
      );
      const before = new RegExp(
        `\\b(the\\s+)?${RANK.replace("|lower|higher|cheaper", "")}\\s+(median|cost|strategy|option|result|worst case|range)\\b[^.]{0,30}?\\b(was|is|came from|belongs to|went to|:)\\s+${n}\\b`,
        "i",
      );
      const m = after.exec(sentence) ?? before.exec(sentence);
      if (m) return m[0];
    }
  }
  return undefined;
}
