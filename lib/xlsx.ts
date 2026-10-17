// Builds a .xlsx of one historical window with LIVE formulas, so anyone can
// audit the maths in Excel, Google Sheets or LibreOffice: change the amount,
// spread or tranches on the Scenario sheet and every cost recalculates.
//
// ExcelJS is passed in so the browser can load it only when someone clicks
// "Download" (it's large), while tests import it directly.

import type ExcelJSType from "exceljs";
import { indexOnOrAfter, trancheDates } from "@/engine/calendar.ts";
import type { sampleWindow } from "@/engine/replay.ts";
import { STRATEGY_IDS, type Scenario, type Series } from "@/engine/types.ts";
import { DISCLAIMER } from "./site.ts";
import { STRATEGY_STYLE } from "./strategy-style.ts";

type ExcelJS = typeof ExcelJSType;
type Window = ReturnType<typeof sampleWindow>;

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const DATE_FMT = "d mmm yyyy";

export function buildWorkbook(
  Excel: ExcelJS,
  fx: Series,
  scenario: Scenario,
  targetBelowSpot: number,
  w: Window,
): ExcelJSType.Workbook {
  const wb = new Excel.Workbook();
  wb.creator = "SpotCheck";
  wb.calcProperties.fullCalcOnLoad = true;
  // Sheet order as it opens: inputs, results, data.
  const sc = wb.addWorksheet("Scenario");
  const st = wb.addWorksheet("Strategies");
  const rates = wb.addWorksheet("Rates");

  // --- Rates: every observation from the window start to the last trade.
  rates.columns = [
    { header: "Date", key: "date", width: 14, style: { numFmt: DATE_FMT } },
    {
      header: `SGD per 1 ${scenario.currency}`,
      key: "rate",
      width: 18,
      style: { numFmt: "0.000000" },
    },
  ];
  const lastTrade = w.results.wait.conversions[0]!.date;
  for (
    let i = indexOnOrAfter(fx, w.start);
    i >= 0 && i < fx.dates.length && fx.dates[i]! <= lastTrade;
    i++
  ) {
    rates.addRow({ date: toDate(fx.dates[i]!), rate: fx.values[i]! });
  }
  const RD = "Rates!$A:$A";
  const RV = "Rates!$B:$B";

  // --- Scenario: the inputs, as named cells the formulas refer to.
  sc.getColumn(1).width = 34;
  sc.getColumn(2).width = 18;
  sc.addRow(["SpotCheck: one historical window"]).font = {
    bold: true,
    size: 14,
  };
  sc.addRow([DISCLAIMER]);
  sc.addRow([]);
  const inputs: [string, ExcelJSType.CellValue, string, string?][] = [
    ["Currency", scenario.currency, "Currency"],
    ["Amount needed (foreign units)", scenario.amount, "Amount", "#,##0.00"],
    ["Window start", toDate(w.start), "Start", DATE_FMT],
    ["Deadline", toDate(w.deadline), "Deadline", DATE_FMT],
    ["Conversions (tranches)", scenario.tranches, "Tranches", "0"],
    ["Conversion spread", scenario.spread, "Spread", "0.00%"],
    [
      "Target: below the starting rate",
      targetBelowSpot,
      "TargetBelow",
      "0.00%",
    ],
  ];
  for (const [label, value, name, fmt] of inputs) {
    const row = sc.addRow([label, value]);
    const cell = row.getCell(2);
    if (fmt) cell.numFmt = fmt;
    wb.definedNames.add(`Scenario!$B$${row.number}`, name);
  }
  const startRate = sc.addRow([
    "Starting rate (SGD per unit)",
    { formula: `VLOOKUP(Start,Rates!$A:$B,2,FALSE)`, result: w.spot },
  ]);
  startRate.getCell(2).numFmt = "0.000000";
  wb.definedNames.add(`Scenario!$B$${startRate.number}`, "StartRate");
  const target = sc.addRow([
    "Target rate",
    {
      formula: "StartRate*(1-TargetBelow)",
      result: w.spot * (1 - targetBelowSpot),
    },
  ]);
  target.getCell(2).numFmt = "0.000000";
  wb.definedNames.add(`Scenario!$B$${target.number}`, "TargetRate");
  sc.addRow([]);
  sc.addRow(["Edit the blue cells; the Strategies sheet recalculates."]).font =
    { italic: true };
  for (let r = 4; r < 4 + inputs.length; r++) {
    sc.getCell(`B${r}`).font = { color: { argb: "FF1F5FBF" } };
  }

  // --- Strategies: one row per conversion, all formulas.
  st.columns = [
    { header: "Strategy", key: "s", width: 28 },
    {
      header: "Scheduled date",
      key: "sched",
      width: 16,
      style: { numFmt: DATE_FMT },
    },
    {
      header: "Trade date (next available rate)",
      key: "trade",
      width: 30,
      style: { numFmt: DATE_FMT },
    },
    { header: "Units", key: "units", width: 14, style: { numFmt: "#,##0.00" } },
    { header: "Rate", key: "rate", width: 12, style: { numFmt: "0.000000" } },
    {
      header: "SGD cost",
      key: "sgd",
      width: 16,
      style: { numFmt: '"S$"#,##0.00' },
    },
  ];
  st.getRow(1).font = { bold: true };
  st.views = [{ state: "frozen", ySplit: 1 }];
  const nextTrade = (dateRef: string) => `MINIFS(${RD},${RD},">="&${dateRef})`;
  const rateOf = (cell: string) => `VLOOKUP(${cell},Rates!$A:$B,2,FALSE)`;

  for (const id of STRATEGY_IDS) {
    const result = w.results[id];
    const first = st.rowCount + 1;
    const sched =
      id === "tranches"
        ? trancheDates(w.start, w.deadline, scenario.tranches)
        : id === "wait"
          ? [w.deadline]
          : [w.start];
    result.conversions.forEach((c, k) => {
      const r = st.rowCount + 1;
      let schedFormula: string;
      let tradeFormula = nextTrade(`B${r}`);
      if (id === "lumpSum") schedFormula = "Start";
      else if (id === "wait") schedFormula = "Deadline";
      else if (id === "tranches") {
        // Evenly spaced calendar days, start to deadline inclusive.
        schedFormula =
          scenario.tranches === 1
            ? "Start"
            : `Start+ROUND(${k}*(Deadline-Start)/(Tranches-1),0)`;
      } else {
        // Target: first day in the window at or below the target, else the deadline.
        schedFormula = "Start";
        const inWindow = `${RD},">="&Start,${RD},"<="&Deadline`;
        tradeFormula = `IF(COUNTIFS(${RV},"<="&TargetRate,${inWindow})>0,MINIFS(${RD},${RV},"<="&TargetRate,${inWindow}),${nextTrade("Deadline")})`;
      }
      const unitsFormula = id === "tranches" ? "Amount/Tranches" : "Amount";
      st.addRow({
        s: k === 0 ? STRATEGY_STYLE[id].label : "",
        sched: { formula: schedFormula, result: toDate(sched[k] ?? w.start) },
        trade: { formula: tradeFormula, result: toDate(c.date) },
        units: { formula: unitsFormula, result: c.units },
        rate: { formula: rateOf(`C${r}`), result: c.rate },
        sgd: { formula: `D${r}*E${r}*(1+Spread)`, result: c.sgd },
      });
    });
    const last = st.rowCount;
    const total = st.addRow({
      s: `${STRATEGY_STYLE[id].label}: total`,
      sgd: { formula: `SUM(F${first}:F${last})`, result: result.totalSgd },
    });
    total.font = { bold: true };
    st.addRow({});
  }
  st.addRow({
    s: "Note: tranche rows are fixed at the tranche count when exported; re-export after changing it.",
  });

  return wb;
}

/** Browser-only: builds the workbook and starts a download. */
export async function downloadWorkbook(
  fx: Series,
  scenario: Scenario,
  targetBelowSpot: number,
  w: Window,
): Promise<void> {
  const Excel = (await import("exceljs")).default;
  const wb = buildWorkbook(Excel, fx, scenario, targetBelowSpot, w);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `spotcheck-${scenario.currency}-${w.start}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
