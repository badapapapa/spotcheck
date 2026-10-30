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
 * median, the middle 90% of periods (5th to 95th percentile) and the most
 * expensive period. Every row is styled the same; nothing is singled out.
 * Hovering a row highlights the same option in the chart above (and the
 * reverse), through `active`.
 */
export function ComparisonTable({
  rows,
  caption,
  rowHeader,
  active,
  onActive,
}: {
  rows: ComparisonRow[];
  caption: string;
  /** Heading of the first column, e.g. "Strategy" or "Hedge". */
  rowHeader: string;
  active?: string | null;
  onActive?: (id: string | null) => void;
}) {
  return (
    <table className="t-small w-full tabular-nums sm:text-[15px]">
      <caption className="sr-only">{caption}</caption>
      <thead className="text-left text-muted-foreground">
        <tr className="bg-sunken">
          <th
            scope="col"
            className="rounded-l-sm py-2 pr-1.5 pl-3 font-medium sm:pr-2"
          >
            {rowHeader}
          </th>
          <th
            scope="col"
            className="px-1.5 py-2 text-right font-medium sm:px-2"
          >
            Median
          </th>
          <th
            scope="col"
            className="px-1.5 py-2 text-right font-medium sm:px-2"
          >
            Middle 90%
          </th>
          <th
            scope="col"
            className="rounded-r-sm py-2 pr-3 pl-1.5 text-right font-medium sm:pl-2"
          >
            Worst case
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ id, label, color, summary: s }) => (
          <tr
            key={id}
            onMouseEnter={() => onActive?.(id)}
            onMouseLeave={() => onActive?.(null)}
            className="border-b transition-opacity duration-150 last:border-0"
            style={{ opacity: active && active !== id ? 0.45 : 1 }}
          >
            <th
              scope="row"
              className="py-3 pr-1.5 pl-3 text-left font-medium sm:pr-2"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                {label}
              </span>
            </th>
            <td className="px-1.5 py-3 text-right sm:px-2">
              {formatSgd(s.median)}
            </td>
            <td className="px-1.5 py-3 text-right sm:px-2">
              {/* Breaks after the dash on narrow screens, never mid-number. */}
              <span className="whitespace-nowrap">{formatSgd(s.p5)}–</span>
              <wbr />
              <span className="whitespace-nowrap">{formatSgd(s.p95)}</span>
            </td>
            <td className="py-3 pr-3 pl-1.5 text-right sm:pl-2">
              {formatSgd(s.max)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
