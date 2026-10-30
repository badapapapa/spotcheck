import type { ForwardQuote } from "@/engine/forwards.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatRate, formatSgd } from "@/lib/format.ts";
import { HelpTip } from "../HelpTip";
import { ValueRows } from "../ValueRows";

type Props = {
  quote: ForwardQuote;
  currency: string;
  amount: number;
  sgdRateDate: string;
  foreignRateDate: string;
};

const pct = (r: number) => `${(r * 100).toFixed(3)}%`;

/** Panel 1: what a forward would lock in today, and why it differs from spot. */
export function ForwardPanel({
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
        Today&apos;s forward fixes the rate now for a conversion on your
        deadline.
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
              value: `${(q.points * 10_000).toFixed(1)} pips (${q.points >= 0 ? "+" : "−"}${formatRate(Math.abs(q.points))})`,
            },
            {
              label: `SGD rate: SORA compounded over the last ${Math.round(q.T * 365)} days, to ${formatDate(sgdRateDate)}`,
              value: pct(q.rd),
            },
            {
              label: `${currency} rate: fed funds compounded the same way, to ${formatDate(foreignRateDate)}`,
              value: pct(q.rf),
            },
          ]}
        />
      </div>
      <p className="mt-4 border-t pt-4 text-[15px]">
        For {amount.toLocaleString("en-SG")} {currency}, the forward price is{" "}
        <span className="font-semibold tabular-nums">
          {formatSgd(Math.abs(carry))}
        </span>{" "}
        {carry < 0 ? "below" : "above"} converting at today&apos;s spot, because{" "}
        {currency} interest rates are {q.rf > q.rd ? "higher" : "lower"} than
        SGD rates over this period. That gap is the carry; it isn&apos;t a
        forecast of where the rate will go.
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        Its price comes from the interest-rate gap between SGD and {currency}{" "}
        (covered interest parity): F = S × (1 + r<sub>SGD</sub> × T) / (1 + r
        <sub>{currency}</sub> × T), T = {q.T.toFixed(3)} years. The rates are
        past compounded overnight rates, a stand-in for the term rates a bank
        would quote, so a real quote will differ a little.
      </p>
    </section>
  );
}
