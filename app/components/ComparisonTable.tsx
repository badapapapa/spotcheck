import type { Summary } from "@/engine/stats.ts";
import { formatPercent, formatSgd } from "@/lib/format.ts";
import { signedSgd } from "@/lib/signed.ts";

export type ComparisonRow = {
  id: string;
  label: string;
  color: string;
  summary: Summary;
  /** Median minus the reference's median (planner: all at once). */
  vsReference?: number;
  /** Share of periods that cost strictly less than the reference. */
  cheaperShare?: number;
};

/**
 * The same measures for every option, in the order given (always the fixed
 * strategy order, never sorted by result), so they compare like for like.
 * Every row is styled the same; nothing is singled out (DESIGN.md §1).
 * Hovering a row highlights the same option in the charts, through `active`.
 *
 * Laptops get a table; phones get the same figures stacked per option, since
 * six columns don't fit a phone. Only one of the two is ever displayed.
 */
export function ComparisonTable({
  rows,
  caption,
  rowHeader,
  reference,
  active,
  onActive,
}: {
  rows: ComparisonRow[];
  caption: string;
  /** Heading of the first column, e.g. "Strategy" or "Hedge". */
  rowHeader: string;
  /** What the reference columns compare with, e.g. "all at once". */
  reference?: string;
  active?: string | null;
  onActive?: (id: string | null) => void;
}) {
  const withReference = reference !== undefined;
  const measures = (r: ComparisonRow): [string, React.ReactNode][] => [
    ["Median", formatSgd(r.summary.median)],
    ...(withReference
      ? ([
          [
            `Median vs ${reference}`,
            r.vsReference === undefined ? "–" : signedSgd(r.vsReference),
          ],
        ] as [string, string][])
      : []),
    [
      "Middle 90%",
      <>
        {/* Breaks after the dash on narrow screens, never mid-number. */}
        <span className="whitespace-nowrap">{formatSgd(r.summary.p5)}–</span>
        <wbr />
        <span className="whitespace-nowrap">{formatSgd(r.summary.p95)}</span>
      </>,
    ],
    ["Worst case", formatSgd(r.summary.max)],
    ...(withReference
      ? ([
          [
            `Cheaper than ${reference}`,
            r.cheaperShare === undefined
              ? "–"
              : `${formatPercent(r.cheaperShare)} of periods`,
          ],
        ] as [string, string][])
      : []),
  ];
  const dim = (id: string) => (active && active !== id ? 0.45 : 1);
  const swatch = (color: string) => (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );

  return (
    <>
      <table className="hidden w-full text-[15px] tabular-nums sm:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-left text-muted-foreground">
          <tr className="t-small bg-sunken">
            <th scope="col" className="rounded-l-sm py-2 pr-2 pl-3 font-medium">
              {rowHeader}
            </th>
            {measures(rows[0]!).map(([label], i, all) => (
              <th
                key={label}
                scope="col"
                className={`px-2 py-2 text-right font-medium ${i === all.length - 1 ? "rounded-r-sm pr-3" : ""}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onMouseEnter={() => onActive?.(r.id)}
              onMouseLeave={() => onActive?.(null)}
              className="border-b transition-opacity duration-150 last:border-0"
              style={{ opacity: dim(r.id) }}
            >
              <th scope="row" className="py-3 pr-2 pl-3 text-left font-medium">
                <span className="flex items-center gap-2">
                  {swatch(r.color)}
                  {r.label}
                </span>
              </th>
              {measures(r).map(([label, value], i, all) => (
                <td
                  key={label}
                  className={`px-2 py-3 text-right ${i === all.length - 1 ? "pr-3" : ""}`}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phones: one block per option, the same measures in the same order. */}
      <ul className="border-t sm:hidden" aria-label={caption}>
        {rows.map((r) => (
          <li
            key={r.id}
            className="border-b py-4 transition-opacity duration-150"
            style={{ opacity: dim(r.id) }}
          >
            <p className="flex items-center gap-2 font-medium">
              {swatch(r.color)}
              {r.label}
            </p>
            <dl className="t-small mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 tabular-nums">
              {measures(r).map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
