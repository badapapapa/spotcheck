import { STRATEGY_IDS, type StrategyId } from "@/engine/types.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";

/**
 * Each strategy in plain terms (DESIGN.md §7): what you'd do, and what it
 * trades. Definitions only; nothing here ranks the strategies.
 */
const GUIDE: Record<
  StrategyId,
  { doing: string; trades: string; detail: string }
> = {
  lumpSum: {
    doing: "Convert the whole amount on your start date.",
    trades:
      "You know the exact cost on day one, so there is no range of outcomes. You also give up any chance of a better rate later.",
    detail:
      "In the replay this is the rate on the start date plus your exchange fee. Because every period is rescaled to today's rate, it costs the same in every period, which is why it appears as a single point.",
  },
  tranches: {
    doing:
      "Convert equal parts on evenly spaced dates from your start date to your deadline.",
    trades:
      "Each part gets a different rate, so the ups and downs partly cancel out. The final cost isn't known until the last part, but no single day decides it.",
    detail:
      'The number of parts is "Most conversions you\'d make" under More options. The first part converts on the start date and the last on the deadline. A date with no published rate uses the next available one.',
  },
  wait: {
    doing: "Convert everything on the day you need it.",
    trades:
      "The whole cost rides on one day's rate. If the rate moves your way you pay less; if it moves against you, nothing has been converted yet.",
    detail:
      "If the deadline falls on a day with no published rate, the replay uses the next available rate.",
  },
  target: {
    doing:
      "Pick a rate a little better than today's (2% by default). Convert everything the first day the rate reaches it; if it never does, convert on the deadline.",
    trades:
      "When the target is reached you pay less than today's rate. When it isn't, you end up converting on the deadline, exactly like waiting.",
    detail:
      "The target is set relative to each period's own starting rate, so periods from different years compare fairly. The check on each day only uses rates up to that day, never later ones. You can change the target under More options.",
  },
};

export function StrategyGuide({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <ol className="border-t">
      {STRATEGY_IDS.map((id) => {
        const g = GUIDE[id];
        return (
          <li
            key={id}
            className="grid gap-x-8 gap-y-2 border-b py-6 md:grid-cols-[11rem_minmax(0,1fr)]"
          >
            <Heading className="t-h3 flex items-baseline gap-2.5 self-start">
              <span
                aria-hidden
                className="size-2.5 shrink-0 translate-y-[-1px] rounded-full"
                style={{ background: STRATEGY_STYLE[id].color }}
              />
              <span>
                {STRATEGY_STYLE[id].label}
                {STRATEGY_STYLE[id].subtitle && (
                  <span className="t-small block font-normal text-muted-foreground">
                    {STRATEGY_STYLE[id].subtitle}
                  </span>
                )}
              </span>
            </Heading>
            <div className="prose-measure space-y-2">
              <p>
                <span className="font-medium">What you&apos;d do. </span>
                {g.doing}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-ink">What it trades. </span>
                {g.trades}
              </p>
              <details className="group">
                <summary className="link inline-flex min-h-11 cursor-pointer list-none items-center text-ui [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">More detail</span>
                  <span className="hidden group-open:inline">Less detail</span>
                  {/* Four toggles on one page: each says whose detail it is. */}
                  <span className="sr-only">: {STRATEGY_STYLE[id].label}</span>
                </summary>
                <p className="t-small text-muted-foreground">{g.detail}</p>
              </details>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
