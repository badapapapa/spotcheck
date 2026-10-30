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

/** For text a user actually sees: stricter, any "should" is out. */
export const BANNED_IN_UI_TEXT: RegExp[] = [
  ...BANNED_IN_SOURCE,
  /\bshould\b/i,
  /recommend/i,
];
