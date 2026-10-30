// Wording SpotCheck must never use (CLAUDE.md rule 3: no financial advice).
// Kept outside the scanned UI folders, since the patterns themselves contain
// the words.

/** For scanning source files, whose comments may say "should". */
export const BANNED_IN_SOURCE: RegExp[] = [
  /\bbest\b/i,
  /\brecommend(s|ed|ation|ations)?\b/i,
  /\byou should\b/i,
  /\bbuy now\b/i,
  /\bsell now\b/i,
  /\bguarantee(d|s)?\b/i,
];

/**
 * For text a user actually sees: stricter. Any "should" is out except the
 * question form "should you", because the planner's heading asks the user's
 * own question ("When should you exchange your money?") and answers it only
 * with what happened in the past. "You should …" stays banned above.
 */
export const BANNED_IN_UI_TEXT: RegExp[] = [
  ...BANNED_IN_SOURCE,
  /\bshould\b(?! you\b)/i,
  /recommend/i,
];
