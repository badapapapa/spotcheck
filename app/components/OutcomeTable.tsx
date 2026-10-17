import type { ReplayResult } from "@/engine/replay.ts";
import { STRATEGY_IDS } from "@/engine/types.ts";
import { formatPercent, formatSgd } from "@/lib/format.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";

/** The chart's numbers as a table (screen readers, and anyone who wants exact values). */
export function OutcomeTable({ result }: { result: ReplayResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm tabular-nums">
        <caption className="sr-only">
          SGD cost of each strategy across historical windows
        </caption>
        <thead className="text-left text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pr-3 font-medium">
              Strategy
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Median
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              5th pct
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              95th pct
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Most expensive
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Cheaper than all at once
            </th>
          </tr>
        </thead>
        <tbody>
          {STRATEGY_IDS.map((id) => {
            const { summary: s, beatLumpSum } = result.stats[id];
            return (
              <tr key={id} className="border-b border-border last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  <span
                    className="mr-2 inline-block size-2.5 rounded-full align-middle"
                    style={{ background: STRATEGY_STYLE[id].color }}
                    aria-hidden
                  />
                  {STRATEGY_STYLE[id].label}
                </th>
                <td className="py-2 pr-3 text-right">{formatSgd(s.median)}</td>
                <td className="py-2 pr-3 text-right">{formatSgd(s.p5)}</td>
                <td className="py-2 pr-3 text-right">{formatSgd(s.p95)}</td>
                <td className="py-2 pr-3 text-right">{formatSgd(s.max)}</td>
                <td className="py-2 text-right">
                  {id === "lumpSum" ? "–" : formatPercent(beatLumpSum)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
