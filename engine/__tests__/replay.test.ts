import { describe, expect, it } from "vitest";
import { addDays } from "../calendar.ts";
import { hedgeReplay, makeOptionPricer } from "../hedge-replay.ts";
import { replay, sampleWindow } from "../replay.ts";
import { STRATEGY_IDS } from "../types.ts";
import { baseScenario, daily, loadDff, loadSora, loadUsd } from "./helpers.ts";

const opts = { targetBelowSpot: 0.02 };

describe("replay", () => {
  it("on a flat history every strategy has the same distribution", () => {
    const fx = daily("2020-01-01", Array(800).fill(1.35));
    const r = replay(
      fx,
      { ...baseScenario, startDate: "2022-01-01", deadline: "2022-07-01" },
      opts,
    );
    for (const id of STRATEGY_IDS) {
      expect(r.stats[id].summary.median).toBeCloseTo(15_000 * 1.35 * 1.005, 6);
      expect(r.stats[id].beatLumpSum).toBe(0);
    }
  });

  it("covers every start date whose window fits in the data", () => {
    const fx = daily("2020-01-01", Array(100).fill(1.35));
    const s = {
      ...baseScenario,
      startDate: "2020-04-09",
      deadline: "2020-04-19",
    }; // 10 days
    const r = replay(fx, s, opts);
    expect(r.windows).toBe(90);
    expect(r.firstStart).toBe("2020-01-01");
    expect(r.lastStart).toBe(addDays("2020-04-09", -10));
  });

  it("counts windows where the target was reached", () => {
    // Falls 1% a day for 5 days, then flat: a 2% target is hit only by
    // windows that start early enough to see two falls.
    const values = [
      1.4,
      1.386,
      1.37214,
      1.3584186,
      1.344834414,
      ...Array(60).fill(1.344834414),
    ];
    const fx = daily("2020-01-01", values);
    const s = {
      ...baseScenario,
      startDate: "2020-03-01",
      deadline: "2020-03-11",
    };
    const r = replay(fx, s, { targetBelowSpot: 0.0199 });
    expect(r.targetHitShare).toBeCloseTo(3 / r.windows, 12);
  });

  it("lump sum relative cost is exactly 1 + spread", () => {
    const r = replay(
      loadUsd(),
      { ...baseScenario, startDate: "2026-10-01", deadline: "2027-08-01" },
      opts,
    );
    for (const c of r.relativeCosts.lumpSum) expect(c).toBeCloseTo(1.005, 12);
  });

  it("look-ahead guard: changing data after day d leaves windows ending by d unchanged", () => {
    const fx = loadUsd();
    const s = {
      ...baseScenario,
      startDate: "2026-10-01",
      deadline: "2027-04-01",
    };
    const cutoff = "2015-06-30";
    const before = replay(fx, s, opts);
    const altered = {
      dates: fx.dates,
      values: fx.values.map((v, i) => (fx.dates[i]! > cutoff ? v * 1.5 : v)),
    };
    const after = replay(altered, s, opts);
    const L = before.windowDays;
    let compared = 0;
    before.startDates.forEach((d, i) => {
      // Windows whose deadline snaps to on or before the cutoff.
      if (addDays(d, L) < addDays(cutoff, -7)) {
        for (const id of STRATEGY_IDS) {
          expect(after.relativeCosts[id][i]).toBe(before.relativeCosts[id][i]);
        }
        compared++;
      }
    });
    expect(compared).toBeGreaterThan(3000);
  });

  it("runs 25+ years of daily USD data inside the 300 ms budget", () => {
    const fx = loadUsd();
    const s = {
      ...baseScenario,
      startDate: "2026-10-17",
      deadline: "2027-08-01",
      tranches: 12,
    };
    const t0 = performance.now();
    const r = replay(fx, s, opts);
    const ms = performance.now() - t0;
    expect(r.windows).toBeGreaterThan(9000);
    // Node is a little faster than a phone browser; the UI also runs this in a worker.
    expect(ms).toBeLessThan(300);
  });

  it("sampleWindow returns each strategy's conversions for one start date", () => {
    const w = sampleWindow(loadUsd(), baseScenario, "2015-03-02", opts);
    expect(w.start).toBe("2015-03-02");
    expect(w.results.tranches.conversions).toHaveLength(6);
    expect(w.results.target.conversions).toHaveLength(1);
  });
});

describe("hedgeReplay", () => {
  const inputs = {
    fx: loadUsd(),
    sgdOvernight: loadSora(),
    foreignOvernight: loadDff(),
    foreignBasis: 360 as const,
  };
  const s = {
    ...baseScenario,
    startDate: "2026-10-01",
    deadline: "2027-04-01",
  };

  it("starts once rate history covers a full window and never runs past the data", () => {
    const r = hedgeReplay(inputs, s, 1.3);
    expect(r.firstStart >= addDays("2005-07-01", 182)).toBe(true);
    expect(addDays(r.lastStart, 182) <= inputs.fx.dates.at(-1)!).toBe(true);
    expect(r.summaries.unhedged!.count).toBe(r.windows);
  });

  it("forward-hedged outcomes vary far less than unhedged ones", () => {
    const r = hedgeReplay(inputs, s, 1.3);
    const spread = (x: { p5: number; p95: number }) => x.p95 - x.p5;
    expect(spread(r.summaries.forward!)).toBeLessThan(
      spread(r.summaries.unhedged!) / 3,
    );
  });

  it("an at-the-money call caps the worst case near spot + premium", () => {
    const pricer = makeOptionPricer(inputs.fx, {
      strikePct: 1,
      volLookback: 60,
    });
    const r = hedgeReplay(inputs, s, 1.3, pricer);
    const opt = r.relativeCosts.option!;
    const unhedged = r.relativeCosts.unhedged!;
    expect(opt).toHaveLength(r.windows);
    // Relative to the starting spot, the option-hedged cost can never exceed
    // strike (= 1) × (1 + spread) + premium, and premiums here are under 10%.
    expect(Math.max(...opt)).toBeLessThan(1.005 + 0.1);
    expect(r.summaries.option!.max).toBeLessThan(r.summaries.unhedged!.max);
    // When the rate fell, the option costs more than unhedged by the premium.
    const cheaper = unhedged.filter((u, i) => u < opt[i]!).length;
    expect(cheaper).toBeGreaterThan(0);
  });

  it("option pricing on day d ignores everything after d (look-ahead guard)", () => {
    const date = "2018-03-01";
    const pricer = makeOptionPricer(inputs.fx, {
      strikePct: 1.02,
      volLookback: 90,
    });
    const args = {
      date,
      deadline: "2018-09-01",
      spot: 1.32,
      rd: 0.012,
      rf: 0.016,
    };
    const altered = {
      dates: inputs.fx.dates,
      values: inputs.fx.values.map((v, i) =>
        inputs.fx.dates[i]! >= date ? v * (1 + (i % 7) / 10) : v,
      ),
    };
    expect(
      makeOptionPricer(altered, { strikePct: 1.02, volLookback: 90 })(args),
    ).toEqual(pricer(args));
  });
});
