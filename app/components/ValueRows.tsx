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
    <dl className="text-[15px]">
      {rows.map((r, i) => (
        <div
          key={r.key ?? (typeof r.label === "string" ? r.label : i)}
          className="flex items-center justify-between gap-4 border-b py-2.5 last:border-0"
        >
          <dt className="flex items-center gap-0.5 text-muted-foreground">
            {r.label}
          </dt>
          <dd className="text-right font-semibold whitespace-nowrap tabular-nums">
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
