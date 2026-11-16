// Evaluates the detector (detect.ts) and writes docs/quality/evaluation.md:
//   (a) recall on the problems listed in scripts/fetch/known-anomalies.ts,
//       with the dropped BRL print of 11 Feb 2000 put back from the raw rates
//   (b) every flag it raises over the whole history, and a threshold sweep
//   (c) synthetic errors put into clean data: hit rate by kind and size,
//       and the false-alarm rate on untouched days
// Reads data/ only and changes nothing in it. Seeded: the same report on
// every run with the same data.
//
//   node scripts/quality/evaluate.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { KNOWN_ANOMALIES } from "../fetch/known-anomalies.ts";
import { features, type DayFeatures, type Series } from "./features.ts";
import {
  allFeatures,
  detect,
  fitOn,
  flagDay,
  peerMoves,
  PROPOSED,
  type Flag,
  type Thresholds,
} from "./detect.ts";
import { peerMedians } from "./features.ts";
import type { Forest } from "./iforest.ts";
import { loadSeries } from "./load.ts";
import { peersOf } from "./peers.ts";
import { randomInt, seeded } from "./rng.ts";
import { featuresBetween, inject, type Injection } from "./synthetic.ts";

/**
 * The ECB rates of 11 Feb 2000 the pipeline drops (known-anomalies.ts), as
 * Frankfurter serves them (v2, ECB provider), checked 16 Nov 2026: BRL and
 * SGD per EUR. SGD per BRL = SGD per EUR / BRL per EUR.
 */
const RAW_BRL_2000_02_11 = {
  date: "2000-02-11",
  brlPerEur: 2.0141,
  sgdPerEur: 1.6627,
};

const SEED = 20261116;
const TRIALS = 300;
const CLEAN_TRIALS = 3000;

const isKnown = (f: Flag) =>
  KNOWN_ANOMALIES.some(
    (a) => a.series === `SGD-${f.code}` && a.date === f.date,
  );
const years = (s: Series) =>
  (Date.parse(s.dates.at(-1)!) - Date.parse(s.dates[0]!)) /
  (365.25 * 86_400_000);

/** BRL with the dropped print put back. */
function brlWithRawPrint(brl: Series): Series {
  const v = RAW_BRL_2000_02_11.sgdPerEur / RAW_BRL_2000_02_11.brlPerEur;
  const i = brl.dates.findIndex((d) => d > RAW_BRL_2000_02_11.date);
  return {
    code: "BRL",
    dates: [
      ...brl.dates.slice(0, i),
      RAW_BRL_2000_02_11.date,
      ...brl.dates.slice(i),
    ],
    values: [...brl.values.slice(0, i), v, ...brl.values.slice(i)],
  };
}

type Recall = {
  entry: string;
  kind: string;
  flag: Flag | null;
  arrival: Flag | null;
  f: DayFeatures;
};

function recall(series: Series[], forest: Forest): Recall[] {
  const byCode = new Map(series.map((s) => [s.code, s]));
  return KNOWN_ANOMALIES.map((a) => {
    const code = a.series.replace("SGD-", "");
    let s = byCode.get(code)!;
    if (a.kind === "upstream-error") s = brlWithRawPrint(s);
    const peers = peersOf(code)
      .map((c) => byCode.get(c)!)
      .filter(Boolean);
    const days = features(s, peerMedians(s.dates, peers));
    const i = days.findIndex((d) => d.date === a.date);
    // On arrival: the night it came in, with no next day yet.
    const onArrival = features(
      {
        code,
        dates: s.dates.slice(0, i + 1),
        values: s.values.slice(0, i + 1),
      },
      peerMedians(s.dates.slice(0, i + 1), peers),
    );
    return {
      entry: `${a.series} ${a.date}`,
      kind: a.kind,
      flag: flagDay(code, days, i, PROPOSED, forest),
      arrival: flagDay(code, onArrival, i, PROPOSED, forest),
      f: days[i]!,
    };
  });
}

type Cell = {
  label: string;
  inj: (up: boolean) => Injection;
  caught: number;
  arrival: number;
  kinds: Record<string, number>;
  trials: number;
};

function synthetic(
  series: Series[],
  moves: Map<string, number[]>,
  all: Map<string, DayFeatures[]>,
  forest: Forest,
) {
  const rand = seeded(SEED);
  const pool = series.filter((s) => all.has(s.code) && s.values.length > 600);
  const pick = () => {
    for (;;) {
      const s = pool[randomInt(rand, pool.length)]!;
      const i = 260 + randomInt(rand, s.values.length - 280);
      // A day (and its neighbours) the detector leaves alone in the real data.
      const days = all.get(s.code)!;
      if (
        [i - 1, i, i + 1, i + 2].every(
          (k) => !flagDay(s.code, days, k, PROPOSED, forest),
        )
      )
        return { s, i };
    }
  };
  const cells: Cell[] = [
    ...[0.01, 0.02, 0.05, 0.1, 0.2, 0.5].map((size) => ({
      label: `spike ${size * 100}%`,
      inj: (up: boolean): Injection => ({ kind: "spike", size, up }),
    })),
    {
      label: "unit ×10 or ÷10",
      inj: (up: boolean): Injection => ({
        kind: "unit",
        factor: up ? 10 : 0.1,
      }),
    },
    {
      label: "unit ×100 or ÷100",
      inj: (up: boolean): Injection => ({
        kind: "unit",
        factor: up ? 100 : 0.01,
      }),
    },
    { label: "inverted", inj: (): Injection => ({ kind: "inverted" }) },
    ...[3, 5, 10].map((days) => ({
      label: `stale ${days} days`,
      inj: (): Injection => ({ kind: "stale", days }),
    })),
  ].map((c) => ({ ...c, caught: 0, arrival: 0, kinds: {}, trials: 0 }));

  for (const cell of cells)
    for (let t = 0; t < TRIALS; t++) {
      const { s, i } = pick();
      const inj = cell.inj(rand() < 0.5);
      const values = inject(s.values, i, inj);
      const span = inj.kind === "stale" ? inj.days : 1;
      const bad = { ...s, values };
      const days = featuresBetween(
        bad,
        moves.get(s.code)!,
        i - 1,
        i + span - 1,
      );
      let hit: Flag | null = null;
      for (let k = 1; k <= span && !hit; k++)
        hit = flagDay(s.code, days, k, PROPOSED, forest);
      // On arrival: the bad day is the latest, so no next day. For a stale
      // run, the night it becomes long enough to flag.
      const last =
        inj.kind === "stale"
          ? i + Math.min(inj.days, PROPOSED.staleDays) - 1
          : i;
      const cut = {
        ...bad,
        dates: bad.dates.slice(0, last + 1),
        values: values.slice(0, last + 1),
      };
      const early = flagDay(
        s.code,
        featuresBetween(cut, moves.get(s.code)!, last - 1, last),
        1,
        PROPOSED,
        forest,
      );
      cell.trials++;
      if (hit) {
        cell.caught++;
        cell.kinds[hit.kind] = (cell.kinds[hit.kind] ?? 0) + 1;
      }
      if (early) cell.arrival++;
    }

  // Untouched days, chosen at random among all of them.
  let flagged = 0;
  for (let t = 0; t < CLEAN_TRIALS; t++) {
    const s = pool[randomInt(rand, pool.length)]!;
    const i = 260 + randomInt(rand, s.values.length - 280);
    if (flagDay(s.code, all.get(s.code)!, i, PROPOSED, forest)) flagged++;
  }
  return { cells, flagged };
}

const SWEEP: { label: string; t: Thresholds }[] = [
  {
    label: "looser",
    t: {
      ...PROPOSED,
      spikeZ: 5,
      spikePeerZ: 5,
      moveZ: 12,
      movePeerZ: 12,
      outlierScore: 0.76,
    },
  },
  { label: "proposed", t: PROPOSED },
  {
    label: "stricter",
    t: {
      ...PROPOSED,
      spikeZ: 8,
      spikePeerZ: 8,
      moveZ: 30,
      movePeerZ: 30,
      outlierScore: 0.8,
    },
  },
  { label: "proposed, no forest", t: { ...PROPOSED, outlierScore: 2 } },
];

const pctOf = (n: number, d: number) => {
  const p = (100 * n) / d;
  return `${p.toFixed(p > 0 && p < 1 ? 2 : 1)}%`;
};
const table = (head: string[], rows: (string | number)[][]) =>
  [
    `| ${head.join(" | ")} |`,
    `|${head.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");

function main() {
  const series = loadSeries();
  const moves = peerMoves(series);
  const all = allFeatures(series, moves);
  const forest = fitOn(all, SEED);
  const checked = [...all.keys()];
  const totalDays = [...all.values()].reduce((a, d) => a + d.length, 0);
  const totalYears = series
    .filter((s) => all.has(s.code))
    .reduce((a, s) => a + years(s), 0);

  const rec = recall(series, forest);
  const flags = detect(all, PROPOSED, forest);
  const fresh = flags.filter((f) => !isKnown(f));
  const perCode = new Map<string, number>();
  for (const f of fresh) perCode.set(f.code, (perCode.get(f.code) ?? 0) + 1);
  const rate = (n: number, y: number) => ((n * 5) / y).toFixed(2);
  const busiest = [...perCode].sort((a, b) => b[1] - a[1]);
  const syn = synthetic(series, moves, all, forest);

  const lines: string[] = [];
  const out = (...l: string[]) => lines.push(...l);
  out(
    "# Data-quality detector: evaluation",
    "",
    "Generated by `node scripts/quality/evaluate.ts` from the committed data. Seeded, so the same data gives the same report. Nothing in `data/` is changed.",
    "",
    `Scope: ${checked.length} FX series against SGD (BND is left out: it is a constant 1:1 peg), ${totalDays.toLocaleString("en-SG")} days, ${totalYears.toFixed(0)} series-years.`,
    "",
    "## What it checks",
    "",
    "Per currency and day, from its daily log return `r` (SGD per unit):",
    "",
    "- **Robust z-score** of `r` against the trailing 250 returns (median and MAD, at least 15 of them; the day itself is never in its own baseline).",
    "- **Peer check:** the same for `r` minus the median move of the other currencies in its region (`scripts/quality/peers.ts`) that day. Moves every SGD cross shares, such as the SGD itself or the euro leg of the ECB crosses, cancel out.",
    "- **Reversal:** whether the next day takes the move back, leaving at most a fifth of it. A bad print comes back; a crisis whipsaw rarely comes all the way back.",
    "- **Stale runs:** the same value on consecutive days.",
    "- **Unit errors:** a day about 10, 100 or 1000 times (or a fraction of) the day before; **inversions:** a day about 1 / the day before.",
    "- **Isolation forest** (100 trees, 256-day samples, seed " +
      SEED +
      ") over the absolute z-score, the absolute peer z-score and the reversal, for unusual combinations the rules miss.",
    "",
    "Flags, one per series and day:",
    "",
    table(
      ["Kind", "Severity", "Rule (proposed thresholds)"],
      [
        [
          "unit",
          "severe",
          "ratio to the day before within 0.1 (in log terms) of 10^k, k = ±1, ±2, ±3",
        ],
        [
          "inverted",
          "severe",
          "value within 0.05 (log) of 1 / the day before, and a move of at least 0.2 (log)",
        ],
        [
          "spike",
          "soft",
          `|z| ≥ ${PROPOSED.spikeZ} and |peer z| ≥ ${PROPOSED.spikePeerZ}, taken back the next day`,
        ],
        [
          "move",
          "soft",
          `|z| ≥ ${PROPOSED.moveZ} and |peer z| ≥ ${PROPOSED.movePeerZ}, taken back or not`,
        ],
        [
          "stale",
          "soft",
          `${PROPOSED.staleDays + 1} or more equal values in a row`,
        ],
        [
          "outlier",
          "soft",
          `forest score ≥ ${PROPOSED.outlierScore}, when no rule above applies`,
        ],
      ],
    ),
    "",
    "## (a) Recall on the known problems",
    "",
    `The BRL print of 11 Feb 2000 is dropped from \`data/\`, so it is put back from the raw ECB rates for this test: ${RAW_BRL_2000_02_11.brlPerEur} BRL and ${RAW_BRL_2000_02_11.sgdPerEur} SGD per EUR (Frankfurter v2, ECB provider, checked 16 Nov 2026), that is ${(RAW_BRL_2000_02_11.sgdPerEur / RAW_BRL_2000_02_11.brlPerEur).toFixed(4)} SGD per BRL, against 0.9534 the day before and 0.9548 the next trading day. "On arrival" is the night the day comes in, before the next day is known.`,
    "",
    table(
      [
        "Entry",
        "Listed as",
        "Move",
        "z",
        "Peer z",
        "Flag (history)",
        "Flag on arrival",
      ],
      rec.map((r) => [
        r.entry,
        r.kind,
        `${(Math.expm1(r.f.r) * 100).toFixed(1)}%`,
        r.f.z.toFixed(1),
        r.f.peerZ.toFixed(1),
        r.flag ? `**${r.flag.kind}**` : "none",
        r.arrival ? r.arrival.kind : "none",
      ]),
    ),
    "",
    `Every "upstream-error" entry caught: **${rec.filter((r) => r.kind === "upstream-error").every((r) => r.flag) ? "yes" : "NO"}**. The "jump" entries are real, reviewed moves; flagging them is expected, and they don't count as false alarms below.`,
    "",
    "## (b) False alarms over the full history",
    "",
    `With the proposed thresholds: **${fresh.length} flags** that aren't in \`known-anomalies.ts\` (${flags.length - fresh.length} more are listed entries), over ${totalYears.toFixed(0)} series-years: **${rate(fresh.length, totalYears)} per currency per 5 years** on average. The busiest: ${busiest
      .slice(0, 5)
      .map(([c, n]) => `${c} ${n}`)
      .join(", ")}. By kind: ${Object.entries(
      fresh.reduce<Record<string, number>>(
        (a, f) => ((a[f.kind] = (a[f.kind] ?? 0) + 1), a),
        {},
      ),
    )
      .map(([k, n]) => `${k} ${n}`)
      .join(", ")}.`,
    "",
    "Threshold sweep (flags not in `known-anomalies.ts`):",
    "",
    table(
      [
        "Setting",
        "spike z / peer z",
        "move z / peer z",
        "forest score",
        "Flags",
        "Per currency per 5 years",
        "BRL 2000-02-11 caught",
      ],
      SWEEP.map(({ label, t }) => {
        const n = detect(all, t, forest).filter((f) => !isKnown(f)).length;
        const brl = rec.find((r) => r.kind === "upstream-error")!;
        const s = series.find((x) => x.code === "BRL")!;
        const withRaw = brlWithRawPrint(s);
        const peers = peersOf("BRL").map((c) =>
          series.find((x) => x.code === c)!,
        );
        const days = features(withRaw, peerMedians(withRaw.dates, peers));
        const caught = flagDay(
          "BRL",
          days,
          days.findIndex((d) => d.date === brl.f.date),
          t,
          forest,
        );
        return [
          label,
          `${t.spikeZ} / ${t.spikePeerZ}`,
          `${t.moveZ} / ${t.movePeerZ}`,
          t.outlierScore > 1 ? "off" : t.outlierScore,
          n,
          rate(n, totalYears),
          caught ? caught.kind : "no",
        ];
      }),
    ),
    "",
    "Every flag the proposed thresholds raise, oldest first:",
    "",
    table(
      ["Date", "Currency", "Kind", "Why"],
      [...fresh]
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.code.localeCompare(b.code),
        )
        .map((f) => [f.date, f.code, f.kind, f.why]),
    ),
    "",
    "## (c) Synthetic errors",
    "",
    `Each row puts one kind of error into ${TRIALS} randomly chosen days (seed ${SEED}) that the detector leaves alone in the real data, one at a time, and counts the days it flags. Spikes go up or down at random and are right again the next day; unit errors and inversions last one day; stale runs repeat the previous value. "On arrival" is the night the bad day comes in, before the next day is known (for a stale run, the night it reaches ${PROPOSED.staleDays + 1} equal values).`,
    "",
    table(
      ["Injected", "Caught", "Caught on arrival", "Caught as"],
      syn.cells.map((c) => [
        c.label,
        pctOf(c.caught, c.trials),
        pctOf(c.arrival, c.trials),
        Object.entries(c.kinds)
          .map(([k, n]) => `${k} ${n}`)
          .join(", ") || "–",
      ]),
    ),
    "",
    `False-positive rate on ${CLEAN_TRIALS.toLocaleString("en-SG")} untouched days chosen at random: **${pctOf(syn.flagged, CLEAN_TRIALS)}** (${syn.flagged} flagged). Over the full history the proposed thresholds flag ${pctOf(flags.length, totalDays)} of all days.`,
    "",
    "## Reading the results",
    "",
    `- **Severe flags fire ${flags.filter((f) => f.severity === "severe").length} times on the real history** and catch ${pctOf(
      syn.cells
        .filter((c) => c.label.startsWith("unit"))
        .reduce((a, c) => a + c.arrival, 0),
      syn.cells
        .filter((c) => c.label.startsWith("unit"))
        .reduce((a, c) => a + c.trials, 0),
    )} of synthetic unit errors and ${pctOf(syn.cells.find((c) => c.label === "inverted")!.arrival, TRIALS)} of inversions on the night they arrive. They are safe to make blocking.`,
    "- **Soft flags are mostly real events:** crisis whipsaws and managed devaluations (ARS, KZT, TRY, ISK in 2008, CHF on 15 Jan 2015, March 2020). That is the cost of catching a quiet bad print like BRL 2000. They are for a person to look at, not to block on.",
    `- **A bad print is mostly caught the night after it arrives,** when the next day takes it back: BRL 2000-02-11 is flagged ${rec[0]!.arrival ? "on arrival" : "one day late"}. Catching it on arrival needs the looser setting, which roughly doubles the soft flags.`,
    "- **Spikes under 2% are mostly missed;** most are within a normal day's range. Stale runs are already refused by the existing validation (no repeated rates except the peg), so the stale rule is a second line.",
    `- **The isolation forest adds little** beyond the rules (${fresh.filter((f) => f.kind === "outlier").length} of the ${fresh.length} flags, small moves in volatile weeks). It is kept as a cheap extra, and the sweep shows the totals without it.`,
    "",
  );
  mkdirSync(join(import.meta.dirname, "..", "..", "docs", "quality"), {
    recursive: true,
  });
  const file = join(
    import.meta.dirname,
    "..",
    "..",
    "docs",
    "quality",
    "evaluation.md",
  );
  writeFileSync(file, lines.join("\n"));
  console.log(
    `Wrote ${file}: ${fresh.length} flags, BRL caught: ${rec[0]?.flag?.kind ?? "no"}`,
  );
}

if (import.meta.main) main();
