"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { daysBetween, rateAsOf } from "@/engine/calendar.ts";
import { convertAmount } from "@/lib/convert.ts";
import { loadFx } from "@/lib/data.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatSgd } from "@/lib/format.ts";
import { todayCost } from "@/lib/today-cost.ts";
import { LIMITS, type PlannerState } from "@/lib/url-state.ts";
import { CurrencyPicker } from "./CurrencyPicker";

type Props = {
  state: PlannerState;
  onChange: (next: PlannerState) => void;
  /** Latest SGD per unit, for today's cost. Planner only. */
  spot?: number;
  /**
   * "panel": the planner's converter, with today's cost.
   * "chips": the compact sentence under the Hedging title.
   */
  variant?: "panel" | "chips";
  /** Lets the planner watch the sentence for the phone summary bar. */
  sentenceRef?: React.Ref<HTMLParagraphElement>;
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
    spread: pctText(s.scenario.spread),
    target: pctText(s.targetBelowSpot),
  };
}

/** 0.005 → "0.5" (no trailing zeros, no float noise). */
const pctText = (fraction: number) =>
  String(Number((fraction * 100).toFixed(4)));

const inRange = (v: number, r: { min: number; max: number }) =>
  Number.isFinite(v) && v >= r.min && v <= r.max;

/**
 * "I need [amount] [currency] by [date]", plus the less common settings in a
 * disclosure. Inputs keep their own text while you type; the URL (and the
 * results) only update when a value is valid, so half-typed numbers never
 * reset the field.
 */
export function ScenarioForm({
  state,
  onChange,
  spot,
  variant = "panel",
  sentenceRef,
}: Props) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => toDraft(state));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>(
    {},
  );
  // The currency picked while its rates load (usually instant: cached).
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // A new currency (picked here, or from the URL via back/forward) brings a
  // new amount, so the fields start again from the state. Adjusting state
  // while rendering is React's documented pattern for this.
  const [draftCurrency, setDraftCurrency] = useState(state.scenario.currency);
  if (draftCurrency !== state.scenario.currency) {
    setDraftCurrency(state.scenario.currency);
    setDraft(toDraft(state));
    setErrors({});
    setPendingCurrency(null);
  }

  /**
   * Switching currency keeps the SGD value of the amount: 15,000 USD becomes
   * about 394,000,000 VND, not 15,000 VND (S$0.73). Only a user's change does
   * this; a shared URL is always taken as written.
   */
  async function changeCurrency(code: string) {
    if (code === state.scenario.currency) return;
    setPendingCurrency(code);
    const { currency: from, amount, startDate } = state.scenario;
    let next = amount;
    try {
      const [a, b] = await Promise.all([loadFx(from), loadFx(code)]);
      next = convertAmount(
        amount,
        rateAsOf(a, startDate).value,
        rateAsOf(b, startDate).value,
      );
    } catch {
      // Rates unavailable: keep the number as typed rather than block the switch.
    }
    onChange({
      ...state,
      scenario: { ...state.scenario, currency: code, amount: next },
    });
  }

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
    "aria-describedby": errors[name]
      ? `${id}-${name}-error`
      : `${id}-${name}-help`,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      update(name, e.target.value),
  });

  const errorText = (name: keyof Draft) =>
    errors[name] ? (
      <p id={`${id}-${name}-error`} className="text-sm text-destructive">
        {errors[name]}
      </p>
    ) : null;

  const s = state.scenario;
  const currency = pendingCurrency ?? s.currency;
  const chips = variant === "chips";
  const cost = spot === undefined ? undefined : todayCost(s, spot);
  const conversions = `${s.tranches} conversion${s.tranches === 1 ? "" : "s"}`;

  return (
    <form
      className={chips ? "max-w-3xl space-y-2" : "space-y-6"}
      onSubmit={(e) => e.preventDefault()}
      aria-label="Scenario"
    >
      {/* Two groups so a phone wraps "by [date]" onto its own line, never
          mid-group; wider screens keep the sentence on one line. */}
      <p
        ref={sentenceRef}
        className={`flex flex-wrap items-center gap-x-2.5 gap-y-2 text-ink ${
          chips ? "text-[18px] font-medium" : "t-data-m"
        }`}
      >
        <span className="flex items-center gap-2 whitespace-nowrap">
          I need
          <input
            {...field("amount")}
            aria-describedby={errors.amount ? `${id}-amount-error` : undefined}
            aria-label={`Amount needed (${s.currency})`}
            inputMode="decimal"
            type="number"
            min={LIMITS.amount.min}
            step="any"
            className="field-chip no-spin text-right tabular-nums"
            // Grows with the number so the sentence stays tidy.
            style={{
              width: `calc(${Math.max(4, draft.amount.length) + 0.5}ch + 1.75rem)`,
            }}
          />
          <CurrencyPicker value={currency} onChange={changeCurrency} />
        </span>
        <span
          className={`flex items-center gap-2 whitespace-nowrap ${
            chips ? "" : "max-sm:basis-full"
          }`}
        >
          by
          <input
            {...field("deadline")}
            aria-describedby={
              errors.deadline ? `${id}-deadline-error` : undefined
            }
            aria-label="Needed by"
            type="date"
            // Sized to the date it shows, so the sentence fits on one line.
            className="field-chip w-[calc(9.2em+1.75rem)] tabular-nums"
          />
        </span>
      </p>
      {errorText("amount")}
      {errorText("deadline")}

      {!chips && (
        // The baseline every strategy is measured against: converting it all
        // today (equal to the All at once result). Same height loaded or not.
        <div className="border-t pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <p className="t-label">Converting it all today</p>
            {cost ? (
              <p className="t-data-m tabular-nums" data-testid="today-cost">
                {formatSgd(cost.withSpread)}
              </p>
            ) : (
              // Invisible text of the same shape, so the row has the same
              // baseline and height before and after the rate arrives.
              <p aria-hidden className="t-data-m">
                <span className="skeleton text-transparent">S$00,000</span>
              </p>
            )}
          </div>
          <p className="t-small mt-1 min-h-5 text-right text-muted-foreground tabular-nums">
            {cost &&
              `${formatSgd(cost.mid)} at mid rate, before your ${pctText(s.spread)}% spread`}
          </p>
        </div>
      )}

      <details
        open={moreOpen}
        onToggle={(e) => setMoreOpen(e.currentTarget.open)}
        className={chips ? "" : "-mt-2"}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[15px] [&::-webkit-details-marker]:hidden">
          <span className="font-medium whitespace-nowrap text-accent">
            More options
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground tabular-nums">
            {conversions}, from {formatDate(s.startDate)}, {pctText(s.spread)}%
            spread, {pctText(state.targetBelowSpot)}% target
          </span>
          <ChevronDown
            aria-hidden
            className={`ml-auto size-4 shrink-0 text-muted-foreground transition-transform ${
              moreOpen ? "rotate-180" : ""
            }`}
          />
        </summary>
        <div className="grid gap-x-4 gap-y-4 pt-3 pb-1 sm:grid-cols-2">
          <Field
            id={`${id}-tranches`}
            label="Most conversions you'd make"
            help="Used by the equal-tranches strategy."
            error={errorText("tranches")}
          >
            <input
              {...field("tranches")}
              inputMode="numeric"
              type="number"
              min={1}
              max={LIMITS.tranches.max}
              step={1}
              className="field-input"
            />
          </Field>
          <Field
            id={`${id}-startDate`}
            label="Start converting from"
            help="The first day of your plan."
            error={errorText("startDate")}
          >
            <input
              {...field("startDate")}
              type="date"
              className="field-input"
            />
          </Field>
          <Field
            id={`${id}-spread`}
            label="Conversion spread (%)"
            help="What your bank or money changer adds on top of the mid rate."
            error={errorText("spread")}
          >
            <input
              {...field("spread")}
              inputMode="decimal"
              type="number"
              min={0}
              max={LIMITS.spreadPct.max}
              step={0.05}
              className="field-input"
            />
          </Field>
          <Field
            id={`${id}-target`}
            label="Target: % below the starting rate"
            help="Used by the target-rate strategy."
            error={errorText("target")}
          >
            <input
              {...field("target")}
              inputMode="decimal"
              type="number"
              min={0}
              max={LIMITS.targetPct.max}
              step={0.5}
              className="field-input"
            />
          </Field>
        </div>
      </details>
    </form>
  );
}

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help: string;
  error: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="t-small font-medium">
        {label}
      </label>
      {children}
      {error ?? (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
    </div>
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
