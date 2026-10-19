// Entry point for `npm run fetch-data` and the daily GitHub Actions job.
// Pass --full to re-download all history.
//
// Any error (a source down, MAS changing its form, a failed check) exits
// with code 1 before anything is written, which fails the workflow step;
// the commit step after it never runs.

import { fetchEcbCrosses } from "./ecb.ts";
import { fetchFx } from "./frankfurter.ts";
import { fetchFredSeries } from "./fred.ts";
import { readJson, writeIfChanged } from "./io.ts";
import { fetchSora } from "./mas.ts";
import { runPipeline } from "./pipeline.ts";

/** Today's date in Singapore, where the data is published. */
function todaySgt(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
}

try {
  await runPipeline({
    today: todaySgt(),
    full: process.argv.includes("--full"),
    fredApiKey: process.env.FRED_API_KEY,
    fetchFx,
    fetchEcbCrosses,
    fetchSora,
    fetchFredSeries,
    readJson,
    writeIfChanged,
    log: (m) => console.log(m),
  });
} catch (err) {
  console.error(
    `\nData update FAILED, nothing written:\n${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}
