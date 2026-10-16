// Minimal static file server for out/, used by the Playwright smoke tests.
// (Cloudflare Pages serves the same files in production, compressed, so this
// gzips text too: otherwise Lighthouse would measure uncompressed sizes.)

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createGzip } from "node:zlib";
import { extname, join, normalize } from "node:path";

const ROOT = join(import.meta.dirname, "..", "out");
const PORT = Number(process.env.PORT ?? 4173);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  // Like Cloudflare Pages: /advanced → advanced.html, then a folder's index.html.
  if (existsSync(`${path}.html`)) path = `${path}.html`;
  else if (existsSync(path) && statSync(path).isDirectory())
    path = join(path, "index.html");
  if (!existsSync(path)) {
    res.writeHead(404).end("Not found");
    return;
  }
  const type = TYPES[extname(path)] ?? "application/octet-stream";
  const compress =
    /text|javascript|json|svg/.test(type) &&
    /\bgzip\b/.test(String(req.headers["accept-encoding"]));
  res.writeHead(200, {
    "Content-Type": type,
    ...(compress
      ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" }
      : {}),
  });
  const stream = createReadStream(path);
  if (compress) stream.pipe(createGzip()).pipe(res);
  else stream.pipe(res);
}).listen(PORT, () => console.log(`Serving out/ on http://localhost:${PORT}`));
