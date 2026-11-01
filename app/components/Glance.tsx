import type { ReplayResult } from "@/engine/replay.ts";
import { STRATEGY_IDS, type StrategyId } from "@/engine/types.ts";
import { formatSgdAt } from "@/lib/format.ts";
import { signedDiff } from "@/lib/signed.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import type { PlannerState } from "@/lib/url-state.ts";
import { CopyLinkButton } from "./CopyLinkButton";

/** The context line that sits next to every set of historical results. */
export const HISTORICAL_CONTEXT =
  "Historical results reflect exchange-rate trends during the periods tested. Different market conditions may produce different outcomes.";

/**
 * The first view of the results (DESIGN.md §1): all four strategies in their
 * fixed order with the same two figures, and no verdict. Which one matters
 * is the user's call; picking a row highlights that strategy everywhere.
 */
export function Glance({
  result,
  state,
  pegged,
  stale,
  outdated,
  active,
  pinned,
  onHover,
  onToggle,
}: {
  result: ReplayResult;
  /** The scenario on screen, for Copy link. */
  state: PlannerState;
  pegged: boolean;
  /** A newer result is on its way: dim this one. */
  stale: boolean;
  /** A field holds a value that isn't valid yet: these are the last results. */
  outdated?: boolean;
  /** Highlighted now (hovered or pinned): the others dim. */
  active: string | null;
  /** Pinned by a click: the only state a button reports as pressed. */
  pinned: string | null;
  onHover: (id: StrategyId | null) => void;
  onToggle: (id: StrategyId) => void;
}) {
  const lump = result.stats.lumpSum.summary.median;
  const shown = `${state.scenario.currency} ${state.scenario.amount.toLocaleString("en-SG")}`;
  return (
    // Results that aren't current keep their place, but their figures turn
    // muted (still 4.5:1, unlike the opacity this replaced) and the line
    // under the heading says why, so they never pass for current ones.
    <div
      data-stale={stale || outdated || undefined}
      aria-busy={stale || undefined}
    >
      <h2 className="t-h3">
        Across {result.windows.toLocaleString("en-SG")} comparable past periods
      </h2>
      {outdated ? (
        <p className="t-small mt-1 font-medium" data-testid="outdated">
          Not current: these are for {shown}, your last valid entry.
        </p>
      ) : stale ? (
        <p
          className="t-small mt-1 text-muted-foreground"
          data-testid="updating"
        >
          Updating these results…
        </p>
      ) : (
        <p className="t-small mt-1 text-muted-foreground">
          Median cost of each strategy, and its difference from converting it
          all at once.
          <span className="max-sm:hidden">
            {" "}
            Select one to follow it through the charts.
          </span>
        </p>
      )}
      <table className="mt-5 w-full tabular-nums">
        <caption className="sr-only">
          Median historical cost of each strategy
        </caption>
        <thead className="t-label text-left">
          <tr className="border-b">
            <th scope="col" className="pb-2 font-medium">
              Strategy
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Median
            </th>
            <th scope="col" className="pb-2 pl-3 text-right font-medium">
              {/* Two short lines on narrow phones, so the names fit on one line. */}
              <span className="max-[25rem]:block">vs all</span>{" "}
              <span className="max-[25rem]:block">at once</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {STRATEGY_IDS.map((id) => {
            const median = result.stats[id].summary.median;
            const dim = active !== null && active !== id;
            return (
              <tr
                key={id}
                className="border-b transition-colors duration-150"
                data-dimmed={dim || undefined}
              >
                <th scope="row" className="text-left font-normal">
                  <button
                    type="button"
                    aria-pressed={pinned === id}
                    onClick={() => onToggle(id)}
                    onMouseEnter={() => onHover(id)}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(id)}
                    onBlur={() => onHover(null)}
                    className="-ml-2 flex min-h-12 w-full items-center gap-2.5 rounded-sm px-2 text-left hover:bg-sunken aria-pressed:bg-sunken"
                  >
                    <span
                      aria-hidden
                      className="mark size-2.5 shrink-0 rounded-full"
                      style={{ background: STRATEGY_STYLE[id].color }}
                    />
                    {STRATEGY_STYLE[id].label}
                  </button>
                </th>
                <td className="t-data-m text-right">
                  {formatSgdAt(median, lump)}
                </td>
                <td className="t-small pl-3 text-right text-muted-foreground">
                  {id === "lumpSum" ? (
                    <span>
                      <span aria-hidden>–</span>
                      <span className="sr-only">the reference</span>
                    </span>
                  ) : (
                    signedDiff(median, lump, lump)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="t-small mt-3 text-muted-foreground" data-testid="vs-key">
        vs all at once: negative = cost less than converting all at once.
      </p>
      {pegged && (
        <p className="t-small mt-3">
          The Brunei dollar is pegged 1:1 to the Singapore dollar, so every
          strategy costs the same, plus your exchange fee.
        </p>
      )}
      <p className="t-small mt-4 text-muted-foreground" data-testid="context">
        {HISTORICAL_CONTEXT}
      </p>
      <p className="t-small mt-2 font-medium">Past outcomes, not a forecast.</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <CopyLinkButton state={state} />
        <a href="#evidence" className="link inline-flex min-h-11 items-center">
          See the full comparison
        </a>
      </div>
    </div>
  );
}

/** While the replay runs: the spot motif, and the number of periods being checked. */
export function GlanceProgress({ periods }: { periods?: number }) {
  return (
    <div aria-live="polite">
      <p className="t-h3">Comparable past periods</p>
      {/* Two lines reserved: the message can wrap on a phone once the
          number of periods is known, and nothing should move when it does. */}
      <div className="mt-4 flex items-start gap-4">
        <div className="spot-track mt-1 shrink-0" aria-hidden />
        <p className="t-small min-h-10 text-muted-foreground">
          {periods === undefined
            ? "Loading the rate history…"
            : `Checking ${periods.toLocaleString("en-SG")} comparable past periods…`}
        </p>
      </div>
      {/* Holds the finished table's height, so nothing below moves. */}
      <div aria-hidden className="mt-4 space-y-3">
        <div className="skeleton h-48" />
        <div className="skeleton h-10 w-11/12" />
      </div>
    </div>
  );
}
