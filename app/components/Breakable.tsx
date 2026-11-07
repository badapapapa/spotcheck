import { Fragment } from "react";

/**
 * A formatted figure that stays in one piece, unless it alone is wider than
 * its box (a huge amount, or text zoomed to 200%): then it wraps after a
 * thousands separator ("S$1,341,⏎126,150,000") instead of pushing the page
 * sideways. The inline block keeps it whole while it fits, so a range still
 * breaks at its dash. `<wbr>` adds no characters, so the figure still reads,
 * copies and is spoken as one number.
 *
 * In a table it never breaks (`.figure` in globals.css): a table would
 * narrow a column to use the break even when the figure fits. A table too
 * wide for its figures switches to its stacked layout instead
 * (lib/use-fit.ts), where they may wrap.
 */
export function Breakable({ children }: { children: string }) {
  const parts = children.split(/(?<=,)/);
  return (
    <span className="figure">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
