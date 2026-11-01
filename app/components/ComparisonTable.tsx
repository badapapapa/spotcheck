import type { Summary } from "@/engine/stats.ts";
import { formatPercent, formatSgdAt } from "@/lib/format.ts";
import { signedDiff } from "@/lib/signed.ts";

export type ComparisonRow = {
  id: string;
  label: string;
  /** A gloss shown under the name ("convert in equal parts"). */
  note?: string;
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
  // One money format for the whole table (whole dollars unless the
  // scenario itself costs under S$100).
  const scale = Math.max(...rows.map((r) => r.summary.median));
  const sgd = (v: number) => formatSgdAt(v, scale);
  const measures = (r: ComparisonRow): [string, React.ReactNode][] => [
    ["Median", sgd(r.summary.median)],
    ...(withReference
      ? ([
          [
            `Median vs ${reference}`,
            // From the rounded medians, so it agrees with the figures shown.
            r.vsReference === undefined
              ? "–"
              : signedDiff(
                  r.summary.median,
                  r.summary.median - r.vsReference,
                  scale,
                ),
          ],
        ] as [string, string][])
      : []),
    [
      "Middle 90%",
      // A strategy with no range (all at once: its cost is known today)
      // says so, rather than showing the same figure twice.
      (() => {
        // Same markup either way, so styling never depends on the results.
        // Fixed when the range rounds to one figure (as in the summary).
        const fixed = sgd(r.summary.p5) === sgd(r.summary.p95);
        return (
          <>
            <span className="whitespace-nowrap">
              {fixed ? `${sgd(r.summary.p5)} ` : `${sgd(r.summary.p5)}–`}
            </span>
            {/* Breaks here on narrow screens, never mid-number. */}
            <wbr />
            <span className="whitespace-nowrap">
              {fixed ? "(fixed)" : sgd(r.summary.p95)}
            </span>
          </>
        );
      })(),
    ],
    ["Most expensive past period", sgd(r.summary.max)],
    ...(withReference
      ? ([
          [
            `Cheaper than ${reference}`,
            r.cheaperShare === undefined
              ? "–"
              : `${formatPercent(r.cheaperShare)} of past periods`,
          ],
        ] as [string, string][])
      : []),
  ];
  const dim = (id: string) => (active && active !== id) || undefined;
  const swatch = (color: string) => (
    <span
      aria-hidden
      className="mark size-2.5 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );

  return (
    <>
      <table className="hidden w-full text-ui tabular-nums sm:table">
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
              className="border-b transition-colors duration-150 last:border-0"
              data-dimmed={dim(r.id)}
            >
              <th scope="row" className="py-3 pr-2 pl-3 text-left font-medium">
                <span className="flex items-center gap-2">
                  {swatch(r.color)}
                  {r.label}
                </span>
                {r.note && (
                  <span className="t-small block pl-4.5 font-normal text-muted-foreground">
                    {r.note}
                  </span>
                )}
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
            className="border-b py-3 transition-colors duration-150"
            data-dimmed={dim(r.id)}
          >
            <p className="flex items-center gap-2 font-medium">
              {swatch(r.color)}
              {r.label}
              {r.note && (
                <span className="t-small font-normal text-muted-foreground">
                  {r.note}
                </span>
              )}
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
