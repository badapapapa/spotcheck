// The planner's schema.org description for search engines (JSON-LD), with
// only fields that are plainly true of the site: free, in English, no sign-up.
// It is a data block, never run as a script, so the CSP doesn't need its
// hash (scripts/csp-hashes.ts leaves it out).

import { PLANNER_DESCRIPTION, SITE_NAME, SITE_URL } from "./site.ts";

export const WEB_APPLICATION = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: PLANNER_DESCRIPTION,
  applicationCategory: "FinanceApplication",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "SGD" },
  inLanguage: "en",
} as const;

/**
 * JSON for a <script type="application/ld+json"> element. "<" is escaped so
 * no value can close the element early.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
