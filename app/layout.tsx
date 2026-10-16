import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import meta from "@/data/meta.json";
import { formatDate } from "@/lib/dates.ts";
import { DISCLAIMER, SITE_NAME, TAGLINE } from "@/lib/site";
import "./globals.css";

// next/font downloads the font at build time and serves it from our own
// origin, so the page makes no third-party requests at runtime.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${SITE_NAME}: historical FX scenarios for exchange students`,
  description: TAGLINE,
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border">
          <div className="mx-auto w-full max-w-3xl px-4 py-4">
            <p className="text-xl font-semibold tracking-tight">{SITE_NAME}</p>
            <p className="text-sm text-muted-foreground">{TAGLINE}</p>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{DISCLAIMER}</p>
            <p>
              Data:{" "}
              {meta.attribution.map((source, i) => (
                <span key={source.name}>
                  {i > 0 && " · "}
                  <a
                    href={source.url}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {source.name}
                  </a>
                </span>
              ))}
              . Rates up to {formatDate(meta.series["SGD-USD"]?.last ?? "")}.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
