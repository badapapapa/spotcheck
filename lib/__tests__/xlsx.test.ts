import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { loadUsd } from "@/engine/__tests__/helpers.ts";
import { sampleWindow } from "@/engine/replay.ts";
import { scheduledDates } from "../scheduled.ts";
import { buildWorkbook } from "../xlsx.ts";

const scenario = {
  currency: "USD",
  amount: 15_000,
  startDate: "2026-10-17",
  deadline: "2027-08-01",
  tranches: 6,
  spread: 0.005,
};

describe("Excel export", async () => {
  const fx = loadUsd();
  const w = sampleWindow(fx, scenario, "2015-03-02", { targetBelowSpot: 0.02 });
  const wb = buildWorkbook(ExcelJS, fx, scenario, 0.02, w);
  // Round-trip through the file format, as a user would open it.
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(await wb.xlsx.writeBuffer());

  it("has the three sheets in order", () => {
    expect(back.worksheets.map((s) => s.name)).toEqual([
      "Scenario",
      "Strategies",
      "Rates",
    ]);
  });

  it("defines the named inputs the formulas use", () => {
    const names = [
      "Amount",
      "Start",
      "Deadline",
      "Tranches",
      "Spread",
      "TargetBelow",
      "StartRate",
      "TargetRate",
    ];
    for (const n of names)
      expect(back.definedNames.getRanges(n).ranges.length, n).toBe(1);
  });

  it("stores every daily rate in the window", () => {
    const rates = back.getWorksheet("Rates")!;
    // A 9-month window holds ~200 trading days (no weekends).
    expect(rates.rowCount - 1).toBeGreaterThan(190);
    const days = rates.getColumn(1).values.slice(2) as Date[];
    expect(days.every((d) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6)).toBe(
      true,
    );
    expect(rates.getCell("B2").value).toBe(w.spot);
  });

  it("writes live formulas whose cached results match the engine", () => {
    const st = back.getWorksheet("Strategies")!;
    const totals: number[] = [];
    let conversions = 0;
    st.eachRow((row, n) => {
      if (n === 1) return;
      const sgd = row.getCell(6).value as ExcelJS.CellFormulaValue | null;
      if (!sgd || typeof sgd !== "object" || !("formula" in sgd)) return;
      if (sgd.formula.startsWith("SUM(")) totals.push(sgd.result as number);
      else {
        conversions++;
        expect(sgd.formula).toMatch(/^D\d+\*E\d+\*\(1\+Spread\)$/);
        expect(
          (row.getCell(5).value as ExcelJS.CellFormulaValue).formula,
        ).toMatch(/^VLOOKUP\(C\d+,Rates!/);
      }
    });
    expect(conversions).toBe(1 + 6 + 1 + 1);
    expect(totals).toEqual([
      w.results.lumpSum.totalSgd,
      w.results.tranches.totalSgd,
      w.results.wait.totalSgd,
      w.results.target.totalSgd,
    ]);
  });

  it("asks spreadsheet apps to recalculate on open", () => {
    expect(wb.calcProperties.fullCalcOnLoad).toBe(true);
  });
});

describe("Excel export: scheduled and rate dates (F03)", async () => {
  const fx = loadUsd();
  // A period whose tranches include Sat 21 Mar 2026 (rate of Mon 23 Mar).
  const w = sampleWindow(fx, scenario, "2026-01-22", { targetBelowSpot: 0.02 });
  const wb = buildWorkbook(ExcelJS, fx, scenario, 0.02, w);
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(await wb.xlsx.writeBuffer());
  const st = back.getWorksheet("Strategies")!;
  const iso = (v: unknown) =>
    ((v as ExcelJS.CellFormulaValue).result as Date).toISOString().slice(0, 10);

  it("names both dates as the period detail does", () => {
    expect(st.getCell("B1").value).toBe("Scheduled date");
    expect(st.getCell("C1").value).toBe("Rate date (next published rate)");
  });

  it("lists each conversion's schedule and the date whose rate was used", () => {
    const rows: [string, string][] = [];
    st.eachRow((row, n) => {
      if (n === 1) return;
      const b = row.getCell(2).value;
      if (b && typeof b === "object" && "formula" in b)
        rows.push([iso(b), iso(row.getCell(3).value)]);
    });
    const expected = (
      ["lumpSum", "tranches", "wait", "target"] as const
    ).flatMap((id) => {
      const sched = scheduledDates(w, scenario.tranches)[id];
      return w.results[id].conversions.map(
        (c, i) => [sched[i]!, c.date] as [string, string],
      );
    });
    expect(rows).toEqual(expected);
    expect(rows).toContainEqual(["2026-03-21", "2026-03-23"]);
  });

  it("target rate's schedule is the deadline when it wasn't reached", () => {
    const formulas: string[] = [];
    st.eachRow((row) => {
      const b = row.getCell(2).value;
      if (b && typeof b === "object" && "formula" in b && b.formula)
        formulas.push(b.formula);
    });
    expect(formulas.at(-1)).toMatch(
      /^IF\(COUNTIFS\(.*\)>0,MINIFS\(.*\),Deadline\)$/,
    );
  });
});
