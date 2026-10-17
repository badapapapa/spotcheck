// Core types shared by the engine and the UI.
//
// Conventions (enforced by naming, checked in tests):
// - FX rates are SGD per 1 unit of foreign currency (e.g. 1.35 SGD per USD).
// - Interest rates are decimals (0.0325, not 3.25), simple, annualised ACT/365
//   unless a name says otherwise.
// - Dates are ISO 'YYYY-MM-DD' strings, compared as strings, parsed only as UTC.

export type ISODate = string;

/** Observations in ascending date order; `values[i]` belongs to `dates[i]`. */
export type Series = { dates: ISODate[]; values: number[] };

export type Scenario = {
  currency: string; // e.g. 'USD'
  amount: number; // foreign units needed
  startDate: ISODate;
  deadline: ISODate;
  tranches: number; // >= 1
  spread: number; // decimal, e.g. 0.005
  targetRate?: number; // SGD per unit, for the target strategy
};

export type StrategyId = "lumpSum" | "tranches" | "wait" | "target";

export const STRATEGY_IDS: readonly StrategyId[] = [
  "lumpSum",
  "tranches",
  "wait",
  "target",
];

export type Conversion = {
  date: ISODate;
  units: number;
  rate: number;
  sgd: number;
};

export type StrategyResult = {
  strategy: StrategyId;
  conversions: Conversion[];
  totalSgd: number;
};
