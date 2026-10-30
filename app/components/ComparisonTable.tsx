import type { Summary } from "@/engine/stats.ts";
import { formatSgd } from "@/lib/format.ts";

export type ComparisonRow = {
  id: string;
  label: string;
  color: string;
  summary: Summary;
};

/**
 * The same three measures for every option, so they compare like for like:
 * median, the middle 90% of windows (5th to 95th percentile) and the most
 * expensive window. Every row is styled the same; nothing is singled out.
 */
export function ComparisonTable({
  rows,
  caption,
  rowHeader,
}: {
  rows: ComparisonRow[];
  caption: string;
  /** Heading of the first column, e.g. "Strategy" or "Hedge". */
  rowHeader: string;
}) {
  return (
    <table className="w-full text-sm tabular-nums sm:text-[15px]">
      <caption className="sr-only">{caption}</caption>
      <thead className="bg-sunken text-left text-muted-foreground sm:whitespace-nowrap">
        <tr>
          <th
            scope="col"
            className="rounded-l-md py-2.5 pr-1.5 pl-3 font-medium"
          >
            {rowHeader}
          </th>
          <th
            scope="col"
            className="px-1.5 sm:px-2 py-2.5 text-right font-medium"
          >
            Median
          </th>
          <th
            scope="col"
            className="px-1.5 sm:px-2 py-2.5 text-right font-medium"
          >
            Middle 90%
          </th>
          <th
            scope="col"
            className="rounded-r-md py-2.5 pr-3 pl-1.5 text-right font-medium"
          >
            Worst case
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ id, label, color, summary: s }) => (
          <tr key={id} className="border-b last:border-0">
            <th scope="row" className="py-3 pr-1.5 pl-3 text-left font-medium">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                {label}
              </span>
            </th>
            <td className="px-1.5 sm:px-2 py-3 text-right">
              {formatSgd(s.median)}
            </td>
            <td className="px-1.5 sm:px-2 py-3 text-right">
              {/* Breaks after the dash on narrow screens, never mid-number. */}
              <span className="whitespace-nowrap">{formatSgd(s.p5)}–</span>
              <wbr />
              <span className="whitespace-nowrap">{formatSgd(s.p95)}</span>
            </td>
            <td className="py-3 pr-3 pl-1.5 text-right">{formatSgd(s.max)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
