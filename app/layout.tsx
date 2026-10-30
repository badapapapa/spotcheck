import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import meta from "@/data/meta.json";
import { formatDate } from "@/lib/dates.ts";
import { DISCLAIMER, SITE_NAME, TAGLINE } from "@/lib/site";
import { Suspense } from "react";
import { SiteNav, SiteNavFallback } from "./components/SiteNav";
import { Wordmark } from "./components/Wordmark";
import "./globals.css";

// next/font downloads the fonts at build time and serves them from our own
// origin, so the page makes no third-party requests at runtime (CSP keeps
// font-src 'self'). One file per family (DESIGN.md §3): Newsreader at its
// single display weight (the variable font with optical sizes is 129 KB;
// this is a fraction of that) for questions and headings, and IBM Plex Sans,
// variable, for everything else, chosen for its clear tabular figures.
const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  // Preloaded: at one weight it is small, and arriving with the first paint
  // means the question never re-flows when the font swaps in.
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${SITE_NAME}: when should you exchange your money?`,
  description: TAGLINE,
  // iPhone/iPad home-screen icon (also served at the conventional path).
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#111311" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const ratesTo = formatDate(meta.series["SGD-USD"]?.last ?? "");
  return (
    <html
      lang="en"
      className={`${serif.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b">
          <div className="page flex h-14 items-center justify-between gap-6 lg:h-16">
            <div className="flex h-full items-center gap-10">
              <Wordmark />
              <Suspense fallback={<SiteNavFallback variant="top" />}>
                <SiteNav variant="top" />
              </Suspense>
            </div>
            <p className="t-small hidden text-muted-foreground lg:block">
              Historical data, not advice
            </p>
          </div>
        </header>

        {/* Bottom padding keeps content clear of the phone tab bar. */}
        <main className="flex-1 pb-24 lg:pb-0">{children}</main>

        <footer className="mt-16 border-t pb-20 lg:mt-24 lg:pb-0">
          <div className="page grid gap-8 py-10 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-5">
              <p className="t-small font-medium">{DISCLAIMER}</p>
              <p className="t-small mt-3 text-muted-foreground">
                Rates up to {ratesTo}. Updated each working day.
              </p>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <p className="t-label">Data</p>
              <ul className="t-small mt-1">
                {meta.attribution.map((source) => (
                  <li key={source.name}>
                    <a
                      href={source.url}
                      className="inline-flex min-h-11 items-center text-muted-foreground underline decoration-rule underline-offset-[3px] hover:text-ink hover:decoration-ink"
                    >
                      {source.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </footer>

        <Suspense fallback={<SiteNavFallback variant="bottom" />}>
          <SiteNav variant="bottom" />
        </Suspense>
      </body>
    </html>
  );
}
