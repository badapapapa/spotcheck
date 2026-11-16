import { describe, expect, it } from "vitest";
import {
  allFeatures,
  detect,
  fitOn,
  flagDay,
  PROPOSED,
  type Thresholds,
} from "../detect.ts";
import { features, type DayFeatures } from "../features.ts";
import { c, fitForest, score } from "../iforest.ts";
import { seeded } from "../rng.ts";
import { featuresBetween, inject } from "../synthetic.ts";
import { walk } from "./helpers.ts";

describe("isolation forest", () => {
  it("normalises by the expected path length", () => {
    expect(c(1)).toBe(0);
    expect(c(2)).toBe(1);
    expect(c(256)).toBeCloseTo(10.24, 2);
  });

  it("scores an isolated point higher than the crowd, the same every run", () => {
    const rand = seeded(3);
    const rows = Array.from({ length: 500 }, () => [rand(), rand()]);
    const forest = fitForest(rows, { seed: 9 });
    const again = fitForest(rows, { seed: 9 });
    const crowd = score(forest, [0.5, 0.5]);
    const alone = score(forest, [8, 8]);
    expect(alone).toBeGreaterThan(crowd + 0.15);
    expect(alone).toBeLessThanOrEqual(1);
    expect(score(again, [8, 8])).toBe(alone);
  });
});

describe("flagDay", () => {
  const calm: DayFeatures = {
    date: "2020-01-07",
    r: 0.001,
    z: 0.5,
    peerZ: 0.4,
    reverses: false,
    staleRun: 0,
    unitPower: null,
    inverted: false,
  };
  const day = (f: Partial<DayFeatures>) => [calm, { ...calm, ...f }];
  const t: Thresholds = { ...PROPOSED, outlierScore: 2 };
  const kind = (f: Partial<DayFeatures>) =>
    flagDay("X", day(f), 1, t)?.kind ?? null;

  it("names each kind, severe ones first", () => {
    expect(kind({})).toBeNull();
    expect(kind({ unitPower: 1, z: 99, peerZ: 99, reverses: true })).toBe(
      "unit",
    );
    expect(kind({ inverted: true })).toBe("inverted");
    expect(kind({ z: 7, peerZ: 7, reverses: true })).toBe("spike");
    expect(kind({ z: 7, peerZ: 7, reverses: false })).toBeNull();
    expect(kind({ z: 21, peerZ: -21, reverses: null })).toBe("move");
    expect(kind({ z: 21, peerZ: 3 })).toBeNull();
    expect(kind({ staleRun: 2 })).toBe("stale");
    expect(kind({ staleRun: 3 })).toBeNull();
    expect(flagDay("X", day({ unitPower: 1 }), 1, t)?.severity).toBe("severe");
    expect(
      flagDay("X", day({ z: 7, peerZ: 7, reverses: true }), 1, t)?.severity,
    ).toBe("soft");
  });

  it("never flags a series' first day", () => {
    expect(flagDay("X", [{ ...calm, unitPower: 1 }], 0, t)).toBeNull();
  });
});

describe("detect", () => {
  // Three peers in one region (Americas) and the pegged BND.
  const series = [
    walk("USD", 400, 11, 1.3),
    walk("CAD", 400, 12, 0.95),
    walk("MXN", 400, 13, 0.07),
    walk("BRL", 400, 14, 0.25),
    { ...walk("BND", 400, 15), values: Array(400).fill(1) },
  ];

  it("leaves clean data alone and skips the peg", () => {
    const all = allFeatures(series);
    expect(all.has("BND")).toBe(false);
    expect(detect(all, PROPOSED, fitOn(all, 1))).toEqual([]);
  });

  it("flags a unit error as severe and a bad print as a spike", () => {
    const brl = series[3]!;
    let values = inject(brl.values, 300, { kind: "unit", factor: 10 });
    values = inject(values, 350, { kind: "spike", size: 0.1, up: false });
    const all = allFeatures([...series.slice(0, 3), { ...brl, values }]);
    const flags = detect(all, PROPOSED);
    expect(flags.map((f) => [f.date, f.kind, f.severity])).toEqual([
      [brl.dates[300], "unit", "severe"],
      [brl.dates[301], "unit", "severe"],
      [brl.dates[350], "spike", "soft"],
    ]);
  });
});

describe("synthetic", () => {
  const s = walk("X", 600, 21, 0.7);

  it("puts each kind of error in at the given day only", () => {
    expect(
      inject(s.values, 5, { kind: "spike", size: 0.2, up: true })[5],
    ).toBeCloseTo(s.values[5]! * 1.2, 12);
    expect(inject(s.values, 5, { kind: "unit", factor: 0.01 })[5]).toBeCloseTo(
      s.values[5]! / 100,
      12,
    );
    expect(inject(s.values, 5, { kind: "inverted" })[5]).toBeCloseTo(
      1 / s.values[5]!,
      12,
    );
    const stuck = inject(s.values, 5, { kind: "stale", days: 3 });
    expect(stuck.slice(4, 9)).toEqual([
      s.values[4],
      s.values[4],
      s.values[4],
      s.values[4],
      s.values[8],
    ]);
    expect(inject(s.values, 5, { kind: "inverted" })[6]).toBe(s.values[6]);
  });

  it("computes a range's features exactly as for the whole series", () => {
    const flat = s.dates.map(() => 0);
    const whole = features(s, flat);
    const part = featuresBetween(s, flat, 400, 402);
    expect(part.slice(0, 3)).toEqual(whole.slice(400, 403));
    expect(part[3]).toEqual(whole[403]);
  });
});
