import type { MetadataRoute } from "next";
import meta from "@/data/meta.json";
import { latestRateDate, PAGE_URLS } from "@/lib/crawl.ts";

// Written to out/sitemap.xml at build time (static export).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  // An ISO date string, written as it is (no time zone conversion).
  const lastModified = latestRateDate(meta.series);
  return PAGE_URLS.map((url) => ({ url, lastModified }));
}
