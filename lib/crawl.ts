// What app/sitemap.ts and app/robots.ts list, kept here so it can be tested
// without Next.

import { SITE_URL } from "./site.ts";

/** The site's pages, as their canonical URLs (lib/page-metadata.ts). */
export const PAGE_URLS = [
  SITE_URL,
  `${SITE_URL}/advanced`,
  `${SITE_URL}/how-it-works`,
] as const;

/**
 * The latest date any committed series reaches (data/meta.json): the day
 * the pages' figures last changed, so the sitemap's lastModified.
 */
export function latestRateDate(
  series: Readonly<Record<string, { last: string }>>,
): string {
  const dates = Object.values(series).map((s) => s.last);
  if (!dates.length) throw new Error("data/meta.json lists no series.");
  return dates.sort().at(-1)!;
}
