import { describe, expect, it } from "vitest";
import { QualityFileSchema, type QualityFile } from "../../../lib/quality.ts";
import { allFeatures } from "../detect.ts";
import { daysBefore, nightly, summary } from "../run.ts";
import { inject } from "../synthetic.ts";
import { walk } from "./helpers.ts";

// Four Americas peers, 400 weekdays from 2020-01-06 (to 2021-07-16).
const clean = [
  walk("USD", 400, 31, 1.3),
  walk("CAD", 400, 32, 0.95),
  walk("MXN", 400, 33, 0.07),
  walk("BRL", 400, 34, 0.25),
];
const brl = clean[3]!;
const withBrl = (values: number[]) =>
  allFeatures([...clean.slice(0, 3), { ...brl, values }]);
const latest = brl.dates.at(-1)!;

describe("daysBefore", () => {
  it("counts calendar days back in UTC", () => {
    expect(daysBefore("2026-03-01", 1)).toBe("2026-02-28");
    expect(daysBefore("2026-11-16", 30)).toBe("2026-10-17");
  });
});

describe("nightly", () => {
  it("judges the last 30 days on a first run", () => {
    let values = inject(brl.values, 300, {
      kind: "spike",
      size: 0.1,
      up: true,
    });
    values = inject(values, 390, { kind: "spike", size: 0.1, up: false });
    const r = nightly(withBrl(values), undefined, { known: [] });
    expect(r.from).toBe(daysBefore(latest, 30));
    expect(r.raised.map((f) => [f.date, f.kind])).toEqual([
      [brl.dates[390], "spike"],
    ]);
    expect(r.file.checkedThrough).toBe(latest);
    expect(QualityFileSchema.parse(r.file)).toEqual(r.file);
  });

  it("then judges the week before the last check again, and every day after", () => {
    const values = inject(brl.values, 396, {
      kind: "spike",
      size: 0.1,
      up: true,
    });
    const prev: QualityFile = { checkedThrough: brl.dates[397]!, open: [] };
    const r = nightly(withBrl(values), prev, { known: [] });
    expect(r.from).toBe(daysBefore(brl.dates[397]!, 7));
    expect(r.raised.map((f) => f.date)).toEqual([brl.dates[396]]);
  });

  it("keeps open flags until their day is reviewed, and drops reviewed days", () => {
    const old = {
      currency: "MXN",
      date: "2020-05-05",
      kind: "move" as const,
      severity: "soft" as const,
      move: -0.05,
      z: -25,
      peerZ: -22,
      score: null,
    };
    const values = inject(brl.values, 395, {
      kind: "spike",
      size: 0.1,
      up: true,
    });
    const prev = { checkedThrough: brl.dates[394]!, open: [old] };
    expect(
      nightly(withBrl(values), prev, { known: [] }).file.open.map(
        (f) => f.currency,
      ),
    ).toEqual(["MXN", "BRL"]);
    const known = [
      {
        series: "SGD-MXN",
        date: "2020-05-05",
        kind: "jump" as const,
        note: "real",
      },
      {
        series: "SGD-BRL",
        date: brl.dates[395]!,
        kind: "upstream-error" as const,
        note: "bad",
      },
    ];
    const r = nightly(withBrl(values), prev, { known });
    expect(r.file.open).toEqual([]);
    expect(r.raised).toEqual([]);
  });

  it("collects severe flags, which fail the job", () => {
    const values = inject(brl.values, 399, { kind: "unit", factor: 100 });
    const r = nightly(
      withBrl(values),
      { checkedThrough: brl.dates[398]!, open: [] },
      { known: [] },
    );
    expect(r.severe.map((f) => [f.date, f.kind])).toEqual([[latest, "unit"]]);
    expect(r.file.open[0]).toMatchObject({
      currency: "BRL",
      kind: "unit",
      severity: "severe",
    });
    expect(summary(r)).toContain("1 severe flag(s): the job fails");
  });

  it("writes numbers and fixed values only", () => {
    const values = inject(brl.values, 390, {
      kind: "spike",
      size: 0.1,
      up: false,
    });
    const [flag] = nightly(withBrl(values), undefined, { known: [] }).file.open;
    expect(Object.keys(flag!).sort()).toEqual(
      [
        "currency",
        "date",
        "kind",
        "move",
        "peerZ",
        "score",
        "severity",
        "z",
      ].sort(),
    );
    // The day's whole move: the injected −10% and the day's own small move.
    expect(flag!.move).toBeCloseTo(values[390]! / values[389]! - 1, 12);
  });

  it("keeps a flag open when the next day makes it look reverted", () => {
    // Day X arrives with a large drop: a "move" on arrival.
    const x = 380;
    const values = inject(brl.values, x, {
      kind: "spike",
      size: 0.3,
      up: false,
    });
    const cut = (n: number) =>
      allFeatures([
        ...clean
          .slice(0, 3)
          .map((s) => ({
            ...s,
            dates: s.dates.slice(0, n),
            values: s.values.slice(0, n),
          })),
        { ...brl, dates: brl.dates.slice(0, n), values: values.slice(0, n) },
      ]);
    const night1 = nightly(cut(x + 1), undefined, { known: [] });
    const first = night1.file.open.find((f) => f.date === brl.dates[x]);
    expect(first).toBeDefined();
    // Day X+1 takes it back: re-judged, X is still open (now as a spike).
    const night2 = nightly(cut(x + 2), night1.file, { known: [] });
    const again = night2.file.open.find((f) => f.date === brl.dates[x]);
    expect(again).toBeDefined();
    expect(again!.severity).toBe("soft");
    // Nothing is ever raised for the day that takes it back.
    expect(night2.file.open.map((f) => f.date)).not.toContain(brl.dates[x + 1]);
  });

  it("never downgrades an open flag", () => {
    const x = 395;
    const values = inject(brl.values, x, {
      kind: "spike",
      size: 0.1,
      up: true,
    });
    const severe = {
      currency: "BRL",
      date: brl.dates[x]!,
      kind: "unit" as const,
      severity: "severe" as const,
      move: 9,
      z: null,
      peerZ: null,
      score: null,
    };
    const r = nightly(
      withBrl(values),
      { checkedThrough: brl.dates[x]!, open: [severe] },
      { known: [] },
    );
    // Re-judged, the day now looks like a soft spike; the severe flag stays.
    expect(r.raised.find((f) => f.date === brl.dates[x])?.severity).toBe(
      "soft",
    );
    expect(r.file.open.find((f) => f.date === brl.dates[x])).toEqual(severe);
  });
});
