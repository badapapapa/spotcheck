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

/**
 * The difference between two figures as they are shown: each is rounded to
 * the scenario's precision first, so medians of S$121 and S$122 differ by
 * "−S$1", never "S$0" (or "−S$0").
 */
export function signedDiff(a: number, b: number, scale: number): string {
  const digits = sgdDigits(scale);
  const round = (v: number) => Number(v.toFixed(digits));
  return signedSgd(Number((round(a) - round(b)).toFixed(digits)), scale);
}
