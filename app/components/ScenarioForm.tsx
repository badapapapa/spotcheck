"use client";

import { useId, useState } from "react";
import { daysBetween } from "@/engine/calendar.ts";
import { CURRENCIES } from "@/engine/currencies.ts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSgd } from "@/lib/format.ts";
import { LIMITS, type PlannerState } from "@/lib/url-state.ts";

type Props = {
  state: PlannerState;
  onChange: (next: PlannerState) => void;
  /** Latest SGD per unit, for the "≈ S$" hint under the amount. */
  spot?: number;
};

type Draft = Record<
  "amount" | "startDate" | "deadline" | "tranches" | "spread" | "target",
  string
>;

function toDraft(s: PlannerState): Draft {
  return {
    amount: String(s.scenario.amount),
    startDate: s.scenario.startDate,
    deadline: s.scenario.deadline,
    tranches: String(s.scenario.tranches),
    spread: String(Number((s.scenario.spread * 100).toFixed(4))),
    target: String(Number((s.targetBelowSpot * 100).toFixed(4))),
  };
}

const inRange = (v: number, r: { min: number; max: number }) =>
  Number.isFinite(v) && v >= r.min && v <= r.max;

/**
 * Inputs keep their own text while you type; the URL (and the results) only
 * update when a value is valid, so half-typed numbers never reset the field.
 */
export function ScenarioForm({ state, onChange, spot }: Props) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => toDraft(state));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>(
    {},
  );

  function update(field: keyof Draft, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    const error = validate(field, next);
    setErrors((e) => ({ ...e, [field]: error }));
    // Changing one date can fix the other's error.
    if (field === "startDate" || field === "deadline") {
      setErrors((e) => ({ ...e, startDate: undefined, deadline: error }));
    }
    if (!error) onChange(apply(state, field, next));
  }

  const field = (name: keyof Draft) => ({
    id: `${id}-${name}`,
    value: draft[name],
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      update(name, e.target.value),
  });

  const errorText = (name: keyof Draft) =>
    errors[name] ? (
      <p id={`${id}-${name}-error`} className="text-xs text-destructive">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => e.preventDefault()}
      aria-label="Scenario"
    >
      <div className="grid content-start gap-1.5 sm:col-span-2">
        <Label htmlFor={`${id}-currency`}>Currency you need</Label>
        <select
          id={`${id}-currency`}
          value={state.scenario.currency}
          onChange={(e) =>
            onChange({
              ...state,
              scenario: { ...state.scenario, currency: e.target.value },
            })
          }
          className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm dark:bg-input/30"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code} · {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid content-start gap-1.5">
        <Label htmlFor={`${id}-amount`}>
          Amount needed ({state.scenario.currency})
        </Label>
        <Input
          {...field("amount")}
          inputMode="decimal"
          type="number"
          min={LIMITS.amount.min}
          step="any"
          className="h-10"
        />
        {errorText("amount")}
        {!errors.amount && (
          // Always takes its line, so the form doesn't jump when rates load.
          <p className="min-h-4 text-xs text-muted-foreground">
            {spot !== undefined &&
              `≈ ${formatSgd(state.scenario.amount * spot)} at the latest mid rate`}
          </p>
        )}
      </div>

      <div className="grid content-start gap-1.5">
        <Label htmlFor={`${id}-tranches`}>
          Most conversions you&apos;d make
        </Label>
        <Input
          {...field("tranches")}
          inputMode="numeric"
          type="number"
          min={1}
          max={LIMITS.tranches.max}
          step={1}
          className="h-10"
        />
        {errorText("tranches")}
      </div>

      <div className="grid content-start gap-1.5">
        <Label htmlFor={`${id}-startDate`}>Start converting from</Label>
        <Input {...field("startDate")} type="date" className="h-10" />
        {errorText("startDate")}
      </div>

      <div className="grid content-start gap-1.5">
        <Label htmlFor={`${id}-deadline`}>Needed by</Label>
        <Input {...field("deadline")} type="date" className="h-10" />
        {errorText("deadline")}
      </div>

      <div className="grid content-start gap-1.5">
        <Label htmlFor={`${id}-spread`}>Conversion spread (%)</Label>
        <Input
          {...field("spread")}
          inputMode="decimal"
          type="number"
          min={0}
          max={LIMITS.spreadPct.max}
          step={0.05}
          className="h-10"
        />
        {errorText("spread") ?? (
          <p className="text-xs text-muted-foreground">
            What your bank or money changer adds on top of the mid rate.
          </p>
        )}
      </div>

      <div className="grid content-start gap-1.5">
        <Label htmlFor={`${id}-target`}>
          Target: % below the starting rate
        </Label>
        <Input
          {...field("target")}
          inputMode="decimal"
          type="number"
          min={0}
          max={LIMITS.targetPct.max}
          step={0.5}
          className="h-10"
        />
        {errorText("target") ?? (
          <p className="text-xs text-muted-foreground">
            Used by the target-rate strategy.
          </p>
        )}
      </div>
    </form>
  );
}

function validate(field: keyof Draft, d: Draft): string | undefined {
  const n = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));
  switch (field) {
    case "amount":
      return inRange(n(d.amount), LIMITS.amount)
        ? undefined
        : "Enter an amount above 0.";
    case "tranches":
      return Number.isInteger(n(d.tranches)) &&
        inRange(n(d.tranches), LIMITS.tranches)
        ? undefined
        : `Enter a whole number from 1 to ${LIMITS.tranches.max}.`;
    case "spread":
      return inRange(n(d.spread), LIMITS.spreadPct)
        ? undefined
        : `Enter 0 to ${LIMITS.spreadPct.max}%.`;
    case "target":
      return inRange(n(d.target), LIMITS.targetPct)
        ? undefined
        : `Enter 0 to ${LIMITS.targetPct.max}%.`;
    case "startDate":
    case "deadline": {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(d.startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(d.deadline)
      ) {
        return "Pick a date.";
      }
      const days = daysBetween(d.startDate, d.deadline);
      if (days < LIMITS.minWindowDays)
        return "The deadline must be at least a week after the start.";
      if (days > LIMITS.maxWindowDays)
        return "Keep the deadline within 3 years of the start.";
      return undefined;
    }
  }
}

function apply(
  state: PlannerState,
  field: keyof Draft,
  d: Draft,
): PlannerState {
  const s = state.scenario;
  switch (field) {
    case "amount":
      return { ...state, scenario: { ...s, amount: Number(d.amount) } };
    case "tranches":
      return { ...state, scenario: { ...s, tranches: Number(d.tranches) } };
    case "spread":
      return { ...state, scenario: { ...s, spread: Number(d.spread) / 100 } };
    case "target":
      return { ...state, targetBelowSpot: Number(d.target) / 100 };
    case "startDate":
    case "deadline":
      return {
        ...state,
        scenario: { ...s, startDate: d.startDate, deadline: d.deadline },
      };
  }
}
