/**
 * Label/value rows with dividers: the label on the left, the number
 * right-aligned in tabular figures. Used instead of tiles (DESIGN.md §7).
 */
export function ValueRows({
  rows,
}: {
  rows: { label: React.ReactNode; value: React.ReactNode; key?: string }[];
}) {
  return (
    <dl className="text-ui">
      {rows.map((r, i) => (
        <div
          key={r.key ?? (typeof r.label === "string" ? r.label : i)}
          // The label takes the room the value leaves, as before. Only when
          // even its longest word can't sit beside the value (200% text, a
          // huge amount) does the value drop below it, and only a value wider
          // than the row wraps.
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b py-2.5 last:border-0"
        >
          <dt className="flex min-w-0 grow basis-0 items-center gap-0.5 text-muted-foreground">
            {r.label}
          </dt>
          <dd className="ml-auto max-w-full shrink-0 text-right font-semibold tabular-nums">
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
