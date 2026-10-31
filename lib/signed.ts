import { formatSgd } from "./format.ts";

/**
 * A difference with its sign: "−S$85" (below) or "+S$120" (above). Plain
 * text, never coloured: whether a difference is good is the user's call.
 */
export function signedSgd(v: number): string {
  const s = formatSgd(Math.abs(v));
  if (s === "S$0" || s === "S$0.00") return s;
  return `${v < 0 ? "−" : "+"}${s}`;
}
