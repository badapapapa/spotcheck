import type { Summary } from "@/engine/stats.ts";
import { formatPercent, formatSgdAt } from "@/lib/format.ts";
import { signedDiff } from "@/lib/signed.ts";
import { useFit } from "@/lib/use-fit.ts";
import { Breakable } from "./Breakable";

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
  // A money figure may wrap after its commas, only if it alone is too wide.
  const money = (text: string) => <Breakable>{text}</Breakable>;
  const measures = (r: ComparisonRow): [string, React.ReactNode][] => [
    ["Median", money(sgd(r.summary.median))],
    ...(withReference
      ? ([
          [
            `Median vs ${reference}`,
            // From the rounded medians, so it agrees with the figures shown.
            r.vsReference === undefined
              ? "–"
              : money(
                  signedDiff(
                    r.summary.median,
                    r.summary.median - r.vsReference,
                    scale,
                  ),
                ),
          ],
        ] as [string, React.ReactNode][])
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
            {fixed ? (
              <>{money(sgd(r.summary.p5))} </>
            ) : (
              money(`${sgd(r.summary.p5)}–`)
            )}
            {/* Breaks here on narrow screens; inside a figure only when
                that figure alone is too wide. */}
            <wbr />
            {money(fixed ? "(fixed)" : sgd(r.summary.p95))}
          </>
        );
      })(),
    ],
    ["Most expensive past period", money(sgd(r.summary.max))],
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
  const fit = useFit<HTMLDivElement>(
    rows.map((r) => `${r.id}:${r.summary.median}:${r.summary.max}`).join(),
  );
  const swatch = (color: string) => (
    <span
      aria-hidden
      className="mark size-2.5 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );

  return (
    // The table from 640px if it fits, else the blocks (lib/use-fit.ts).
    <div ref={fit} className="fit">
      <table className="fit-table w-full text-ui tabular-nums">
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
      <ul className="fit-blocks border-t" aria-label={caption}>
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
            {/* Each label beside its value; a value too wide to share the
                line (a huge amount, 200% text) moves under its label, which
                keeps its words whole. */}
            <dl className="t-small mt-2 space-y-1 tabular-nums">
              {measures(r).map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap items-baseline justify-between gap-x-4"
                >
                  <dt className="grow basis-0 text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="ml-auto max-w-full text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
