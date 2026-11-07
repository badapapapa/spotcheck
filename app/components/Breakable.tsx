import { Fragment } from "react";

/**
 * A formatted figure that stays in one piece, unless it alone is wider than
 * its box (a huge amount, or text zoomed to 200%): then it wraps after a
 * thousands separator ("S$1,341,⏎126,150,000") instead of pushing the page
 * sideways. The inline block keeps it whole while it fits, so a range still
 * breaks at its dash. `<wbr>` adds no characters, so the figure still reads,
 * copies and is spoken as one number.
 */
export function Breakable({ children }: { children: string }) {
  const parts = children.split(/(?<=,)/);
  return (
    <span className="inline-block max-w-full">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
