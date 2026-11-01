// The one legend every chart uses (DESIGN.md §6): left-aligned, in the
// order given (the fixed strategy or hedge order, never the library's), with
// names in muted text and the colour carried only by the mark beside them.

export type MarkShape = "circle" | "diamond" | "square" | "triangle";

/** A strategy's marker shape, 12px, as drawn on the period chart. */
export function Marker({ shape, color }: { shape: MarkShape; color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="size-3 shrink-0">
      {shape === "circle" && <circle cx="6" cy="6" r="5" fill={color} />}
      {shape === "square" && (
        <rect x="1.5" y="1.5" width="9" height="9" fill={color} />
      )}
      {shape === "diamond" && (
        <path d="M6 0.5 11.5 6 6 11.5 0.5 6Z" fill={color} />
      )}
      {shape === "triangle" && <path d="M6 1 11.5 11H0.5Z" fill={color} />}
    </svg>
  );
}

/** A 16×2px line sample, for series drawn as lines. */
export function LineMark({
  color,
  muted = false,
}: {
  color: string;
  muted?: boolean;
}) {
  return (
    <span
      aria-hidden
      className="mark h-0.5 w-4 shrink-0 rounded-full"
      style={{ background: color, opacity: muted ? 0.6 : undefined }}
    />
  );
}

export type LegendItem = {
  key: string;
  label: string;
  color: string;
  /** "line" for a line series, otherwise the marker shape. */
  mark: "line" | MarkShape;
  /** The rate line is drawn in ink at 60%; its sample matches. */
  muted?: boolean;
};

export function ChartLegend({
  items,
  className = "",
}: {
  items: LegendItem[];
  className?: string;
}) {
  return (
    <ul
      className={`t-small flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground ${className}`}
    >
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          {item.mark === "line" ? (
            <LineMark color={item.color} muted={item.muted} />
          ) : (
            <Marker shape={item.mark} color={item.color} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * A strategy's marker drawn on a chart at (x, y), about 11px across, with a
 * 2px --surface ring so it stays distinct where it overlaps the line.
 */
export function PointMark({
  shape,
  color,
  x,
  y,
}: {
  shape: MarkShape;
  color: string;
  x: number;
  y: number;
}) {
  const ring = { fill: color, stroke: "var(--surface)", strokeWidth: 2 };
  if (shape === "circle") return <circle cx={x} cy={y} r={5.5} {...ring} />;
  if (shape === "square")
    return <rect x={x - 5} y={y - 5} width={10} height={10} {...ring} />;
  if (shape === "diamond")
    return (
      <path
        d={`M${x} ${y - 6.5}L${x + 6.5} ${y}L${x} ${y + 6.5}L${x - 6.5} ${y}Z`}
        {...ring}
      />
    );
  return (
    <path
      d={`M${x} ${y - 6.5}L${x + 6.5} ${y + 5}L${x - 6.5} ${y + 5}Z`}
      {...ring}
    />
  );
}
