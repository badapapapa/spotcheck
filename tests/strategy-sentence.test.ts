import { describe, expect, it } from "vitest";
import {
  STRATEGY_SENTENCE,
  comparesStrategies,
  namesRanking,
} from "./advisory-patterns.ts";

// Round D renamed two words in the summary sentence. This proves the new
// safeguard is exactly as strict as the old one: every sentence below is
// written once in each pattern's own words, and both patterns must reject
// every bad sentence and accept every good one.

/** The pattern before Round D, kept here only for this comparison. */
const PREVIOUS =
  /^(Equal tranches|Wait until deadline|Target rate)( \([^)]*\))?: median ([−+]S\$[\d,.]+|S\$0(\.00)?) vs all at once, middle 90% (S\$[\d,.]+–S\$[\d,.]+|S\$[\d,.]+ \(fixed\)), worst case S\$[\d,.]+; cheaper than all at once in \d+% of windows\.$/;

const VOCAB = {
  previous: { pattern: PREVIOUS, worst: "worst case", of: "windows" },
  current: {
    pattern: STRATEGY_SENTENCE,
    worst: "most expensive past period",
    of: "past periods",
  },
};

/** {W} is the worst-case measure's name, {O} what the share is "of". */
const GOOD = [
  "Equal tranches (6 conversions): median −S$85 vs all at once, middle 90% S$18,511–S$19,963, {W} S$21,017; cheaper than all at once in 57% of {O}.",
  "Wait until deadline: median +S$12 vs all at once, middle 90% S$17,832–S$20,421, {W} S$22,028; cheaper than all at once in 49% of {O}.",
  "Target rate (2% below the starting rate, reached in 65% of {O}): median −S$396 vs all at once, middle 90% S$18,792–S$20,334, {W} S$22,028; cheaper than all at once in 70% of {O}.",
  "Equal tranches (6 conversions): median S$0 vs all at once, middle 90% S$15,075 (fixed), {W} S$15,075; cheaper than all at once in 0% of {O}.",
];

const BAD: [string, string][] = [
  // Comparing two non-reference strategies.
  [
    "vs another strategy",
    "Equal tranches (6 conversions): median −S$85 vs wait until deadline, middle 90% S$18,511–S$19,963, {W} S$21,017; cheaper than all at once in 57% of {O}.",
  ],
  [
    "cheaper than another strategy",
    "Equal tranches (6 conversions): median −S$85 vs all at once, middle 90% S$18,511–S$19,963, {W} S$21,017; cheaper than Target rate in 57% of {O}.",
  ],
  [
    "two strategies in one sentence",
    "Equal tranches and Target rate: median −S$85 vs all at once, middle 90% S$18,511–S$19,963, {W} S$21,017; cheaper than all at once in 57% of {O}.",
  ],
  [
    "a pairwise clause added",
    "Equal tranches (6 conversions): median −S$85 vs all at once, middle 90% S$18,511–S$19,963, {W} S$21,017; cheaper than all at once in 57% of {O}, and lower than waiting.",
  ],
  // Ranking or advice.
  [
    "a ranking word",
    "Equal tranches (6 conversions): the lowest median −S$85 vs all at once, middle 90% S$18,511–S$19,963, {W} S$21,017; cheaper than all at once in 57% of {O}.",
  ],
  [
    "a verdict appended",
    "Equal tranches (6 conversions): median −S$85 vs all at once, middle 90% S$18,511–S$19,963, {W} S$21,017; cheaper than all at once in 57% of {O}. It was the best choice.",
  ],
  [
    "advice appended",
    "Target rate (2% below): median −S$396 vs all at once, middle 90% S$18,792–S$20,334, {W} S$22,028; cheaper than all at once in 70% of {O}. You should use it.",
  ],
  // Mismatched measures.
  [
    "a measure missing",
    "Equal tranches (6 conversions): median −S$85 vs all at once, {W} S$21,017; cheaper than all at once in 57% of {O}.",
  ],
  [
    "measures out of order",
    "Equal tranches (6 conversions): median −S$85 vs all at once, {W} S$21,017, middle 90% S$18,511–S$19,963; cheaper than all at once in 57% of {O}.",
  ],
  [
    "an extra measure",
    "Equal tranches (6 conversions): median −S$85 vs all at once, middle 90% S$18,511–S$19,963, best case S$17,100, {W} S$21,017; cheaper than all at once in 57% of {O}.",
  ],
  [
    "the mean instead of the median",
    "Equal tranches (6 conversions): mean −S$85 vs all at once, middle 90% S$18,511–S$19,963, {W} S$21,017; cheaper than all at once in 57% of {O}.",
  ],
  [
    "an unsigned difference",
    "Equal tranches (6 conversions): median S$85 vs all at once, middle 90% S$18,511–S$19,963, {W} S$21,017; cheaper than all at once in 57% of {O}.",
  ],
  [
    "a different range",
    "Equal tranches (6 conversions): median −S$85 vs all at once, middle 50% S$18,511–S$19,963, {W} S$21,017; cheaper than all at once in 57% of {O}.",
  ],
  // Strategies outside the template.
  [
    "the reference itself",
    "All at once: median S$0 vs all at once, middle 90% S$19,271 (fixed), {W} S$19,271; cheaper than all at once in 0% of {O}.",
  ],
  [
    "an informal name",
    "Waiting: median −S$137 vs all at once, middle 90% S$17,832–S$20,421, {W} S$22,028; cheaper than all at once in 57% of {O}.",
  ],
  // A probability rather than a share of history.
  [
    "a probability",
    "Equal tranches (6 conversions): median −S$85 vs all at once, middle 90% S$18,511–S$19,963, {W} S$21,017; 57% chance of being cheaper than all at once.",
  ],
];

const fill = (s: string, w: string, o: string) =>
  s.replaceAll("{W}", w).replaceAll("{O}", o);

describe("STRATEGY_SENTENCE is as strict as before Round D", () => {
  for (const [name, v] of Object.entries(VOCAB)) {
    it.each(GOOD)(`${name} pattern accepts the template: %s`, (s) => {
      expect(fill(s, v.worst, v.of)).toMatch(v.pattern);
    });
    it.each(BAD)(`${name} pattern rejects %s`, (_, s) => {
      expect(fill(s, v.worst, v.of)).not.toMatch(v.pattern);
    });
  }

  it("neither pattern accepts the other's words", () => {
    for (const s of GOOD) {
      expect(fill(s, VOCAB.previous.worst, VOCAB.previous.of)).not.toMatch(
        STRATEGY_SENTENCE,
      );
      expect(fill(s, VOCAB.current.worst, VOCAB.current.of)).not.toMatch(
        PREVIOUS,
      );
    }
  });

  it("the other detectors still catch the comparisons and rankings", () => {
    const { worst, of } = VOCAB.current;
    expect(comparesStrategies(fill(BAD[0]![1], worst, of))).toBeDefined();
    expect(comparesStrategies(fill(BAD[2]![1], worst, of))).toBeDefined();
    expect(
      namesRanking("Target rate had the lowest median of the four."),
    ).toBeDefined();
    for (const s of GOOD) {
      expect(comparesStrategies(fill(s, worst, of))).toBeUndefined();
      expect(namesRanking(fill(s, worst, of))).toBeUndefined();
    }
  });
});
