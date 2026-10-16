import type { ForwardQuote } from "@/engine/forwards.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/dates.ts";
import { formatRate, formatSgd } from "@/lib/format.ts";

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
  const rows: [string, React.ReactNode][] = [
    [
      `Spot (${formatDate(q.spotDate)})`,
      `${formatRate(q.spot)} SGD per ${currency}`,
    ],
    [
      `Forward to ${formatDate(q.deadline)}`,
      `${formatRate(q.forward)} SGD per ${currency}`,
    ],
    [
      "Forward points",
      `${(q.points * 10_000).toFixed(1)} pips (${q.points >= 0 ? "+" : "−"}${formatRate(Math.abs(q.points))})`,
    ],
    [
      `SGD rate: SORA compounded over the last ${Math.round(q.T * 365)} days, to ${formatDate(sgdRateDate)}`,
      pct(q.rd),
    ],
    [
      `${currency} rate: fed funds compounded the same way, to ${formatDate(foreignRateDate)}`,
      pct(q.rf),
    ],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s forward</CardTitle>
        <CardDescription>
          A forward fixes the rate today for a conversion on your deadline. Its
          price comes from the interest-rate gap between SGD and {currency}{" "}
          (covered interest parity).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[1fr_auto]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium tabular-nums sm:text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="rounded-lg bg-muted px-4 py-3 text-sm">
          For {amount.toLocaleString("en-SG")} {currency}, the forward price is{" "}
          {formatSgd(Math.abs(carry))} {carry < 0 ? "below" : "above"}{" "}
          converting at today&apos;s spot, because {currency} interest rates are{" "}
          {q.rf > q.rd ? "higher" : "lower"} than SGD rates over this period.
          That gap is the carry; it isn&apos;t a forecast of where the rate will
          go.
        </p>
        <p className="text-xs text-muted-foreground">
          F = S × (1 + r<sub>SGD</sub> × T) / (1 + r<sub>{currency}</sub> × T),
          T = {q.T.toFixed(3)} years. The rates are past compounded overnight
          rates, a stand-in for the term rates a bank would quote, so a real
          quote will differ a little.
        </p>
      </CardContent>
    </Card>
  );
}
