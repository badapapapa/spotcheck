import type { ForwardQuote } from "@/engine/forwards.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatPips, formatRate, formatSgdAt } from "@/lib/format.ts";
import { spotWhen, type StartContext } from "@/lib/start-context.ts";
import { HelpTip } from "../HelpTip";
import { ValueRows } from "../ValueRows";

type Props = {
  /** Which day the forward is priced on (see start-context.ts). */
  ctx: StartContext;
  quote: ForwardQuote;
  currency: string;
  amount: number;
  sgdRateDate: string;
  foreignRateDate: string;
};

const pct = (r: number) => `${(r * 100).toFixed(3)}%`;

/** Panel 1: what a forward would lock in today, and why it differs from spot. */
export function ForwardPanel({
  ctx,
  quote: q,
  currency,
  amount,
  sgdRateDate,
  foreignRateDate,
}: Props) {
  const carry = (q.forward - q.spot) * amount;
  return (
    <section aria-labelledby="forward-title">
      <h2 id="forward-title" className="t-h2">
        What a forward locks in
      </h2>
      <p className="mt-3 text-muted-foreground">
        {ctx.kind === "latest"
          ? "Today's forward fixes the rate now for a conversion on your deadline."
          : ctx.kind === "past"
            ? `A forward on ${formatDate(ctx.rateDate)} fixes the rate that day for a conversion on your deadline.`
            : `Priced from the latest rates (${formatDate(ctx.rateDate)}): a forward fixes the rate for a conversion on your deadline.`}
      </p>
      <div className="mt-4">
        <ValueRows
          rows={[
            {
              label: `Spot (${formatDate(q.spotDate)})`,
              value: `${formatRate(q.spot)} SGD per ${currency}`,
            },
            {
              label: `Forward to ${formatDate(q.deadline)}`,
              value: `${formatRate(q.forward)} SGD per ${currency}`,
            },
            {
              key: "points",
              label: (
                <>
                  Forward points
                  <HelpTip term="forward points">
                    The gap between the forward and spot rates, in pips (0.0001
                    SGD). It comes from the difference in interest rates, not
                    from a view on where the rate is heading.
                  </HelpTip>
                </>
              ),
              value: formatPips(q.points),
            },
            {
              key: "sgd-rate",
              label: (
                <span>
                  SGD rate: SORA compounded over the last{" "}
                  {Math.round(q.T * 365)} days, to {formatDate(sgdRateDate)}
                  <HelpTip term="SORA" inline>
                    The Singapore Overnight Rate Average, published by the
                    Monetary Authority of Singapore: what banks pay to borrow
                    SGD overnight. Compounded over your plan&apos;s length, it
                    stands in for the SGD interest rate.
                  </HelpTip>
                </span>
              ),
              value: pct(q.rd),
            },
            {
              key: "foreign-rate",
              label: (
                <span>
                  {currency} rate: fed funds compounded the same way, to{" "}
                  {formatDate(foreignRateDate)}
                  <HelpTip term="fed funds" inline>
                    The US federal funds rate, from the Federal Reserve (via
                    FRED): what banks pay to borrow USD overnight. Compounded
                    the same way, it stands in for the USD interest rate.
                  </HelpTip>
                </span>
              ),
              value: pct(q.rf),
            },
          ]}
        />
      </div>
      <p className="mt-4 border-t pt-4 text-ui">
        For {amount.toLocaleString("en-SG")} {currency}, the forward fixes a
        rate{" "}
        <span className="font-semibold tabular-nums">
          {/* The headline's precision: whole dollars for a plan of S$100+. */}
          {formatSgdAt(Math.abs(carry), q.spot * amount)}
        </span>{" "}
        {carry < 0 ? "below" : "above"} converting at {spotWhen(ctx)}, because{" "}
        {currency} interest rates are {q.rf > q.rd ? "higher" : "lower"} than
        SGD rates over this period. That gap is the carry; it isn&apos;t a
        forecast of the rate&apos;s direction.
        <HelpTip term="carry" inline>
          The difference between the two currencies&apos; interest rates over
          your plan. A forward has to build it in, so the forward rate sits away
          from spot. It isn&apos;t a view on where the rate goes next, and it
          isn&apos;t a saving or a cost of its own.
        </HelpTip>
      </p>
      <p className="mt-3 text-annotation text-muted-foreground">
        Its price comes from the interest-rate gap between SGD and {currency}{" "}
        (covered interest parity): F = S × (1 + r<sub>SGD</sub> × T) / (1 + r
        <sub>{currency}</sub> × T), T = {q.T.toFixed(3)} years. The rates are
        past compounded overnight rates, a stand-in for the term rates a bank
        would quote, so a real quote differs a little.
      </p>
    </section>
  );
}
