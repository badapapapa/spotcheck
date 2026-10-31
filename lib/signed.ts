import { formatSgd, sgdDigits } from "./format.ts";

/**
 * A difference with its sign: "−S$85" (below) or "+S$120" (above). Plain
 * text, never coloured: whether a difference is good is the user's call.
 * `scale` (the scenario's cost) sets whole dollars or cents, as everywhere
 * else in that scenario.
 */
export function signedSgd(v: number, scale?: number): string {
  const s = formatSgd(Math.abs(v), {
    decimals: scale === undefined ? undefined : sgdDigits(scale),
  });
  if (/^S\$0(\.00)?$/.test(s)) return s;
  return `${v < 0 ? "−" : "+"}${s}`;
}
