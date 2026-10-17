// Small fetch wrapper for the data job: timeout, retries with backoff, and a
// clear error that never includes query strings (they may hold an API key).

const USER_AGENT = "SpotCheck data job (educational, non-commercial)";

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  { retries = 5, timeoutMs = 60_000 } = {},
): Promise<Response> {
  const safeUrl = url.split("?")[0];
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...init.headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} from ${safeUrl}`);
      // 4xx other than 429 won't fix itself on retry.
      if (res.status < 500 && res.status !== 429) break;
      // Rate limited: wait as long as the server asks (seconds).
      const retryAfter = Number(res.headers.get("retry-after"));
      if (res.status === 429 && retryAfter > 0) {
        console.log(`  rate limited by ${safeUrl}; waiting ${retryAfter}s`);
        await sleep(retryAfter * 1000 + 500);
        continue;
      }
    } catch (err) {
      lastError = new Error(
        `Request to ${safeUrl} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    await sleep(2 ** attempt * 1000);
  }
  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
