// Site-wide copy, kept in one place so wording can be reviewed (and tested)
// against the no-advice rule.

export const SITE_NAME = "SpotCheck";

export const TAGLINE =
  "See how converting your exchange money would have played out.";

export const DISCLAIMER =
  "Educational tool using historical mid-market rates. Not financial advice. Past rates don't predict future ones.";

// Placeholder until meta.json exists (Phase 1); then the footer reads
// attribution strings and last-updated dates from there.
export const DATA_SOURCES = [
  { name: "Frankfurter", href: "https://frankfurter.dev/" },
  {
    name: "Monetary Authority of Singapore",
    href: "https://www.mas.gov.sg/",
  },
  { name: "FRED", href: "https://fred.stlouisfed.org/" },
] as const;
