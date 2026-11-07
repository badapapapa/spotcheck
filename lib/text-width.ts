// The width of a line of text in the page's own font, for SVG labels that
// must not run into each other (the range chart's names, medians and axis
// ticks). Measured with a canvas; without one (the static HTML), a generous
// estimate.

let ctx: CanvasRenderingContext2D | null | undefined;

/** The body font, as the browser resolved it (IBM Plex Sans). */
function family(): string {
  return typeof document === "undefined"
    ? "sans-serif"
    : getComputedStyle(document.body).fontFamily;
}

export function textWidth(text: string, px: number, weight = 400): number {
  if (ctx === undefined)
    ctx =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * px * 0.62;
  ctx.font = `${weight} ${px}px ${family()}`;
  // A little extra for tabular figures, which the canvas sets proportionally.
  return ctx.measureText(text).width * 1.04;
}
