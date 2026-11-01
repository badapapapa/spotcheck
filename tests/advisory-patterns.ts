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

/**
 * The ways a non-reference strategy can be referred to in a sentence. All at
 * once is the reference every strategy is measured against, so it may appear
 * alongside one of these; two of these in one sentence is a comparison
 * between strategies, which the generated text must never make.
 */
const NON_REFERENCE: RegExp[] = [
  /\b(equal tranches|spreading over|spread over)\b/i,
  /\b(wait until deadline|waiting|wait until the deadline)\b/i,
  /\b(target rate|a target)\b/i,
];

/**
 * Sentences that compare two non-reference strategies with each other
 * (e.g. "spreading over 6 conversions had a most expensive case S$1,152
 * lower than waiting"). Returns the offending sentence, if any.
 */
export function comparesStrategies(text: string): string | undefined {
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const named = NON_REFERENCE.filter((r) => r.test(sentence)).length;
    if (named >= 2) return sentence;
  }
  return undefined;
}

/**
 * The one template every non-reference strategy's summary sentence follows:
 * the same measures, in the same order, against all at once only.
 *
 * Round D renamed two words in the UI ("worst case" → "most expensive past
 * period", "windows" → "past periods"). Only those words changed here; the
 * structure is identical, and tests/strategy-sentence.test.ts runs the same
 * bad sentences against this and the previous pattern to show both reject
 * every one.
 */
export const STRATEGY_SENTENCE =
  /^(Equal tranches|Wait until deadline|Target rate)( \([^)]*\))?: median ([−+]S\$[\d,.]+|S\$0(\.00)?) vs all at once, middle 90% (S\$[\d,.]+–S\$[\d,.]+|S\$[\d,.]+ \(fixed\)), most expensive past period S\$[\d,.]+; cheaper than all at once in \d+% of past periods\.$/;
