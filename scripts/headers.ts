// Reads _headers (Cloudflare Pages' format): a path pattern, then indented
// "Name: value" lines, or "! Name" to detach a header an earlier rule set.
// Used by the local server, so tests run with the same CSP and caching as
// production, and by the tests.
//
// It combines rules the way Cloudflare documents
// (developers.cloudflare.com/pages/configuration/headers/): every matching
// rule applies, in file order; a header set by more than one is joined with
// ", "; and "! Name" removes what earlier rules set.

export type HeaderOp =
  { name: string; value: string } | { name: string; detach: true };
export type HeaderRule = { pattern: string; ops: HeaderOp[] };

export function parseHeaders(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), ops: [] });
      continue;
    }
    const entry = line.trim();
    if (entry.startsWith("! ")) {
      rules.at(-1)!.ops.push({ name: entry.slice(2).trim(), detach: true });
      continue;
    }
    const i = entry.indexOf(":");
    rules.at(-1)!.ops.push({
      name: entry.slice(0, i).trim(),
      value: entry.slice(i + 1).trim(),
    });
  }
  return rules;
}

/** Every header that applies to `path` ("*" matches anything). */
export function headersFor(
  rules: HeaderRule[],
  path: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  // Header names are case-insensitive; the first spelling is kept.
  const key = (name: string) =>
    Object.keys(out).find((k) => k.toLowerCase() === name.toLowerCase());
  for (const r of rules) {
    const re = new RegExp(
      "^" +
        r.pattern
          .split("*")
          .map((s) => s.replace(/[.?+^$()[\]{}|\\]/g, "\\$&"))
          .join(".*") +
        "$",
    );
    if (!re.test(path)) continue;
    for (const op of r.ops) {
      const k = key(op.name);
      if ("detach" in op) {
        if (k) delete out[k];
      } else if (k) out[k] = `${out[k]}, ${op.value}`;
      else out[op.name] = op.value;
    }
  }
  return out;
}
