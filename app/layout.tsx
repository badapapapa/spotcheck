import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Plus_Jakarta_Sans } from "next/font/google";
import meta from "@/data/meta.json";
import { formatDate } from "@/lib/dates.ts";
import { DISCLAIMER, SITE_NAME, TAGLINE } from "@/lib/site";
import { Suspense } from "react";
import { SiteNav, SiteNavFallback } from "./components/SiteNav";
import { Wordmark } from "./components/Wordmark";
import "./globals.css";

// next/font downloads the fonts at build time and serves them from our own
// origin, so the page makes no third-party requests at runtime (CSP keeps
// font-src 'self'). Jakarta is for headings and the big figures; Plex Sans for
// everything else, chosen for its clear tabular figures (DESIGN.md §4).
// Both are variable fonts: one file each covers every weight we use, which
// keeps the font requests (and the time to first meaningful paint) down.
const display = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  // Not preloaded: the body face carries the first paint, and the heading
  // face swaps in moments later over a size-matched fallback (no shift).
  preload: false,
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${SITE_NAME}: historical FX scenarios for exchange students`,
  description: TAGLINE,
  // iPhone/iPad home-screen icon (also served at the conventional path).
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1020" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b bg-card">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-16 lg:px-8">
            <div className="flex h-full items-center gap-8">
              <Wordmark />
              <Suspense fallback={<SiteNavFallback variant="top" />}>
                <SiteNav variant="top" />
              </Suspense>
            </div>
            <p className="hidden text-sm text-muted-foreground lg:block">
              Educational only, not advice
            </p>
          </div>
        </header>

        {/* Bottom padding keeps content clear of the phone tab bar. */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-24 sm:px-6 lg:px-8 lg:pt-6 lg:pb-12">
          {children}
        </main>

        <footer className="bg-navy pb-16 text-[color:var(--on-navy-muted)] lg:pb-0">
          <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8 text-sm sm:px-6 lg:px-8">
            <p className="font-medium text-[color:var(--on-navy)]">
              {DISCLAIMER}
            </p>
            <div>
              <p>Data:</p>
              <ul className="mt-1">
                {meta.attribution.map((source) => (
                  <li key={source.name}>
                    <a
                      href={source.url}
                      className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-[color:var(--on-navy)]"
                    >
                      {source.name}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Rates up to {formatDate(meta.series["SGD-USD"]?.last ?? "")}.
              </p>
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
