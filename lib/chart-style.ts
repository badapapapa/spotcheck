// One chart language (DESIGN.md §6). The Recharts charts take their axis,
// grid, tooltip and line styling from here, so the period chart, the payoff
// chart and the Greeks can't drift apart. Values match the CSS tokens.

/** Tick labels: --muted at the chart size (--text-chart, 12px). */
export const AXIS_TICK = { fill: "var(--muted)", fontSize: 12 } as const;

/** Axis lines and horizontal gridlines: hairlines in --rule. */
export const AXIS_STROKE = "var(--rule)";

/** Series lines are 2px everywhere. */
export const LINE_WIDTH = 2;

/** The dashed "today" marker on the payoff and Greek charts. */
export const REFERENCE_LINE = {
  stroke: "var(--muted)",
  strokeDasharray: "4 4",
} as const;

/** Labels on reference lines, at the tick size. */
export const REFERENCE_LABEL = {
  fill: "var(--muted)",
  fontSize: 12,
} as const;

/**
 * Recharts' own tooltip box, matched to our tooltips (the period chart's):
 * --surface, a --rule hairline, 8px radius, the pop shadow and 14px text.
 */
export const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: 8,
  boxShadow: "var(--shadow-pop)",
  color: "var(--ink)",
  fontSize: 14,
  lineHeight: "20px",
  padding: 12,
} as const;
