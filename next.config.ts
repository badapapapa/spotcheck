import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: `next build` writes plain HTML/JS/CSS to `out/`, which
  // Cloudflare Pages serves. There is no server at runtime.
  output: "export",
  // The default image loader needs a server; static export requires this.
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
