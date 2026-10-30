import type { ReplayResult } from "@/engine/replay.ts";
import type { StrategyId } from "@/engine/types.ts";
import { historicalAnswer } from "@/lib/answer.ts";
import { formatPercent, formatSgd } from "@/lib/format.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { CopyLinkButton } from "./CopyLinkButton";

/** How each strategy reads inside a sentence ("lower than …"). */
const AS_PHRASE: Record<StrategyId, string> = {
  lumpSum: "converting all at once",
  tranches: "equal tranches",
  wait: "waiting until the deadline",
  target: "a target rate",
};

/**
 * The answer to "when should I exchange?", as a statement about the past
 * (DESIGN.md §1): which strategy had the lowest median cost across the
 * comparable periods, and the evidence for it. Every figure comes from the
 * replay; nothing here tells anyone what to do next.
 */
export function Result({
  result,
  pegged,
  stale,
}: {
  result: ReplayResult;
  pegged: boolean;
  stale: boolean;
}) {
  const a = historicalAnswer(result);
  const name = STRATEGY_STYLE[a.lowest].label;
  const periods = a.windows.toLocaleString("en-SG");

  let headline: string;
  if (pegged)
    headline =
      "The Brunei dollar is pegged 1:1 to the Singapore dollar, so every strategy costs the same, plus your spread.";
  else if (a.noClearLowest)
    headline =
      "No strategy had a clearly lower median cost across comparable past periods.";
  else
    headline = `${name} had the lowest median cost across comparable past periods.`;

  const worse = a.worstGap < 0;
  // A gap that rounds to nothing is "the same", not "S$0.00 lower".
  const sameWorst = /^S\$0(\.00)?$/.test(formatSgd(Math.abs(a.worstGap)));
  return (
    <div
      className={`transition-opacity duration-150 ${stale ? "opacity-60" : ""}`}
      aria-busy={stale || undefined}
    >
      <p className="t-label flex justify-between gap-4">
        <span>Your historical result</span>
        <span className="tabular-nums">{periods} periods tested</span>
      </p>
      <p className="t-result mt-4" data-testid="answer">
        {headline}
      </p>
      {!pegged && !a.noClearLowest && (
        <dl className="mt-6 border-t">
          <Metric
            value={formatSgd(a.medianGap)}
            label={`lower median cost than ${AS_PHRASE[a.reference]}`}
          />
          <Metric
            value={formatPercent(a.cheaperWindows / a.windows)}
            label={`of ${periods} comparable periods, cheaper than ${AS_PHRASE[a.reference]}`}
          />
          {sameWorst ? (
            <Metric
              value="Same"
              label={`worst-case cost as ${AS_PHRASE[a.worstReference]}`}
            />
          ) : (
            <Metric
              value={formatSgd(Math.abs(a.worstGap))}
              negative={worse}
              label={`${worse ? "higher" : "lower"} worst-case cost than ${AS_PHRASE[a.worstReference]}`}
            />
          )}
        </dl>
      )}
      <p className="t-small mt-5 font-medium">Past outcomes, not a forecast.</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <CopyLinkButton />
        <a href="#evidence" className="link inline-flex min-h-11 items-center">
          See the evidence
        </a>
      </div>
    </div>
  );
}

function Metric({
  value,
  label,
  negative = false,
}: {
  value: string;
  label: string;
  negative?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-baseline gap-4 border-b py-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
      {/* Label first for screen readers; the figure is drawn first. */}
      <dt className="t-small text-muted-foreground">{label}</dt>
      <dd
        className={`t-data-m order-first tabular-nums ${negative ? "text-negative" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

/** While the replay runs: the spot motif, and the number of periods being checked. */
export function ResultProgress({ periods }: { periods?: number }) {
  return (
    <div aria-live="polite">
      <p className="t-label">Your historical result</p>
      <div className="mt-6 flex items-center gap-4">
        <div className="spot-track" aria-hidden />
        <p className="t-small text-muted-foreground">
          {periods === undefined
            ? "Loading the rate history…"
            : `Checking ${periods.toLocaleString("en-SG")} comparable past periods…`}
        </p>
      </div>
      {/* Holds the finished result's height, so nothing below moves. */}
      <div aria-hidden className="mt-6 space-y-3">
        <div className="skeleton h-8 w-11/12" />
        <div className="skeleton h-8 w-3/4" />
        <div className="skeleton mt-6 h-40" />
      </div>
    </div>
  );
}
