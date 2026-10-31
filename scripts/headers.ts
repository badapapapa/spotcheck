// Reads public/_headers (Cloudflare Pages' format): a path pattern, then
// indented "Name: value" lines. Used by the local server, so tests run with
// the same CSP and caching as production, and by tests/headers.test.ts.

export type HeaderRule = { pattern: string; headers: Record<string, string> };

export function parseHeaders(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), headers: {} });
      continue;
    }
    const i = line.indexOf(":");
    rules.at(-1)!.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return rules;
}

/** Every header that applies to `path` ("*" matches anything). */
export function headersFor(
  rules: HeaderRule[],
  path: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rules) {
    const re = new RegExp(
      "^" +
        r.pattern
          .split("*")
          .map((s) => s.replace(/[.?+^$()[\]{}|\\]/g, "\\$&"))
          .join(".*") +
        "$",
    );
    if (re.test(path)) Object.assign(out, r.headers);
  }
  return out;
}
