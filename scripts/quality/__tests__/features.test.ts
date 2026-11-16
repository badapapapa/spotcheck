import { describe, expect, it } from "vitest";
import {
  features,
  logReturns,
  looksInverted,
  peerMedians,
  reversesMove,
  staleRuns,
  unitPower,
} from "../features.ts";
import { REGIONS, peersOf } from "../peers.ts";
import { CURRENCIES } from "../../../engine/currencies.ts";
import { walk } from "./helpers.ts";

describe("unit errors and inversions", () => {
  it("finds ×10, ×100 and ×1000 (and their fractions), and nothing else", () => {
    expect(unitPower(Math.log(10), 0.1)).toBe(1);
    expect(unitPower(Math.log(0.01), 0.1)).toBe(-2);
    expect(unitPower(Math.log(1000 * 1.05), 0.1)).toBe(3);
    expect(unitPower(Math.log(1.5), 0.1)).toBeNull();
    expect(unitPower(Math.log(5), 0.1)).toBeNull();
  });

  it("tells an inverted value from an ordinary move", () => {
    expect(looksInverted(1 / 0.7, 0.7)).toBe(true);
    expect(looksInverted(0.5, 2.02)).toBe(true);
    // A real 30% fall is not an inversion.
    expect(looksInverted(0.49, 0.7)).toBe(false);
    // Near 1, an inversion is a small move and can't be told apart.
    expect(looksInverted(1 / 0.98, 0.98)).toBe(false);
  });
});

describe("reversesMove", () => {
  it("needs the other direction and at most a fifth left over", () => {
    expect(reversesMove(-0.1, 0.095, 0.2)).toBe(true);
    expect(reversesMove(-0.1, 0.11, 0.2)).toBe(true);
    expect(reversesMove(-0.1, 0.05, 0.2)).toBe(false);
    expect(reversesMove(-0.1, -0.1, 0.2)).toBe(false);
  });
});

describe("logReturns and staleRuns", () => {
  it("returns NaN first, then ln of each ratio", () => {
    const r = logReturns([1, 2, 1]);
    expect(r[0]).toBeNaN();
    expect(r[1]).toBeCloseTo(Math.LN2, 12);
    expect(r[2]).toBeCloseTo(-Math.LN2, 12);
  });

  it("counts repeats ending at each day", () => {
    expect(staleRuns([1, 1, 1, 2, 2, 3])).toEqual([0, 1, 2, 0, 1, 0]);
  });
});

describe("peers", () => {
  it("puts every currency but the pegged BND in exactly one region", () => {
    const listed = Object.values(REGIONS).flat();
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(
      CURRENCIES.map((c) => c.code)
        .filter((c) => c !== "BND")
        .sort(),
    );
    expect(peersOf("BRL")).toContain("MXN");
    expect(peersOf("BRL")).not.toContain("BRL");
    expect(peersOf("XXX")).toEqual([]);
  });

  it("takes the median move of the peers that have the day", () => {
    const a = { code: "A", dates: ["d1", "d2"], values: [1, 1.01] };
    const b = { code: "B", dates: ["d1", "d2"], values: [1, 1.03] };
    const c = { code: "C", dates: ["d1", "d2"], values: [1, 1.02] };
    const d = { code: "D", dates: ["d1"], values: [1] };
    const m = peerMedians(["d1", "d2", "d3"], [a, b, c, d]);
    expect(m[0]).toBeNaN();
    expect(m[1]).toBeCloseTo(Math.log(1.02), 12);
    expect(m[2]).toBeNaN();
    expect(peerMedians(["d2"], [a, b])[0]).toBeNaN();
  });
});

describe("features", () => {
  const base = walk("X", 400, 1);
  const flat = base.dates.map(() => 0);

  it("gives a one-day bad print a large z that reverses", () => {
    const values = [...base.values];
    values[300] = values[300]! * 0.9;
    const days = features({ ...base, values }, flat);
    expect(days[300]!.z).toBeLessThan(-20);
    expect(days[300]!.reverses).toBe(true);
    expect(days[301]!.reverses).toBe(false);
    expect(days.at(-1)!.reverses).toBeNull();
  });

  it("cancels a move the peers share in the peer z-score", () => {
    const values = [...base.values];
    for (let i = 300; i < values.length; i++) values[i] = values[i]! * 0.95;
    const shared = flat.map((_, i) => (i === 300 ? Math.log(0.95) : 0));
    const days = features({ ...base, values }, shared);
    expect(Math.abs(days[300]!.z)).toBeGreaterThan(10);
    expect(Math.abs(days[300]!.peerZ)).toBeLessThan(2);
  });

  it("marks a stuck value and a unit error", () => {
    const values = [...base.values];
    values[200] = values[199]!;
    values[201] = values[199]!;
    values[350] = values[350]! * 100;
    const days = features({ ...base, values }, flat);
    expect(days[201]!.staleRun).toBe(2);
    expect(days[350]!.unitPower).toBe(2);
    expect(days[351]!.unitPower).toBe(-2);
  });
});
