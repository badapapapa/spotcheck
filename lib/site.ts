// Site-wide copy, kept in one place so wording can be reviewed (and tested)
// against the no-advice rule.

export const SITE_NAME = "SpotCheck";

export const SITE_URL = "https://spotcheck-fx.pages.dev";

export const PLANNER_DESCRIPTION =
  "See how four ways of converting SGD for your exchange would have played out, replayed over every comparable past period since 1999. Historical data, not advice.";

export const DISCLAIMER =
  "Educational tool using historical mid-market rates. Not financial advice. Past rates don't predict future ones.";

export const HEDGING_DESCRIPTION =
  "Prices a USD forward and a call option for the same plan, with a historical comparison of unhedged, forward and option costs. Not quotes, and not advice.";

// Search-result titles (the <title> and link previews; each page's h1 is
// its own). Kept under 60 characters so results don't cut them off.
export const TITLES = {
  planner: "Converting SGD for exchange: past rates replayed | SpotCheck",
  hedging: "SGD/USD forward and option costs for your plan | SpotCheck",
  howItWorks: "How SpotCheck replays SGD conversion strategies",
} as const;
