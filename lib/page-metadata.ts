// Title, description and link-preview tags for one page.
//
// A page's own title doesn't reach a preview tag inherited from the layout,
// so each page sets all of them together. A shared link always shows this
// fixed image: the scenario in its query string never reaches a preview.

import type { Metadata } from "next";
import { SITE_NAME } from "./site.ts";

const PREVIEW_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "SpotCheck: What difference does your exchange strategy make? Historical data, not advice.",
};

export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      images: [PREVIEW_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [PREVIEW_IMAGE],
    },
  };
}
