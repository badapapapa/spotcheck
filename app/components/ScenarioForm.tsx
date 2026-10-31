"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { addDays, rateAsOf } from "@/engine/calendar.ts";
import type { ISODate } from "@/engine/types.ts";
import { convertAmount } from "@/lib/convert.ts";
import {
  latestDeadline,
  MIN_WINDOW_DAYS,
  maxTranches,
  tranchesRange,
  windowError,
} from "@/lib/coverage.ts";
import { loadFx } from "@/lib/data.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatSgdAt } from "@/lib/format.ts";
import { formatNumberText, readNumberField } from "@/lib/number-input.ts";
import { todayCost } from "@/lib/today-cost.ts";
import { LIMITS, serializeState, type PlannerState } from "@/lib/url-state.ts";
import { CurrencyPicker } from "./CurrencyPicker";

/** A date problem, and the field it belongs under. */
export type DateIssue = { field: "startDate" | "deadline"; message: string };

type Props = {
  state: PlannerState;
  onChange: (next: PlannerState) => void;
  /** SGD per unit on the start date, for the cost of converting it all. Planner only. */
  spot?: number;
  /** "today", "on 2 Jan 2025"…: when converting it all would happen. */
  convertWhen?: string;
  /** No cost to show (the start date is outside the data): a dash, not a placeholder. */
  noCost?: boolean;
  /**
   * The page's own date rules (the data's first day, Hedging's look-back).
   * A date they reject is shown under its field and never committed.
   */
  checkDates?: (start: ISODate, deadline: ISODate) => DateIssue | undefined;
  /** A problem with the committed dates (e.g. from a link), shown under its field. */
  dateIssue?: DateIssue;
  /** Earliest and latest start the data allows, for the date picker. */
  startRange?: { min?: ISODate; max?: ISODate };
  /** Tells the page whether any field holds a value that isn't valid yet. */
  onValidity?: (invalid: boolean) => void;
  /**
   * "panel": the planner's converter, with the cost of converting it all.
   * "chips": the compact sentence under the Hedging title.
   */
  variant?: "panel" | "chips";
};

type Name =
  "amount" | "startDate" | "deadline" | "tranches" | "spread" | "target";
type Draft = Record<Name, string>;

/** How long typing must pause before a valid number is used. */
const COMMIT_DELAY_MS = 400;

function toDraft(s: PlannerState): Draft {
  return {
    amount: formatNumberText(s.scenario.amount),
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

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "I need [amount] [currency] by [date]", plus the less common settings in a
 * disclosure. Fields keep their own text while you type. A number is used
 * only once the whole entry is valid and typing has paused (or the field
 * loses focus), so typing "15" never passes through 1; until then the
 * results stay on the last valid entry and the page marks them not current.
 */
export function ScenarioForm({
  state,
  onChange,
  spot,
  convertWhen = "today",
  noCost = false,
  checkDates,
  dateIssue,
  startRange,
  onValidity,
  variant = "panel",
}: Props) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => toDraft(state));
  const [errors, setErrors] = useState<Partial<Record<Name, string>>>({});
  const [note, setNote] = useState<string | undefined>();
  const [focused, setFocused] = useState<Name | null>(null);
  // The currency picked while its rates load (usually instant: cached).
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(
    () => dateIssue?.field === "startDate",
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The state this form last showed or committed. Anything else (a link,
  // back/forward, a new currency, a "start on…" button) brings new values,
  // so the fields start again from the state. Adjusting state while
  // rendering is React's documented pattern for this.
  const key = serializeState(state).toString();
  const [synced, setSynced] = useState(key);
  if (synced !== key) {
    setSynced(key);
    setDraft(toDraft(state));
    setErrors({});
    setNote(undefined);
    setPendingCurrency(null);
  }

  // A date problem arriving from the page (a shared link) opens its field.
  const [seenIssue, setSeenIssue] = useState(dateIssue?.message);
  if (seenIssue !== dateIssue?.message) {
    setSeenIssue(dateIssue?.message);
    if (dateIssue?.field === "startDate") setMoreOpen(true);
  }

  const invalid = Object.values(errors).some(Boolean);
  useEffect(() => onValidity?.(invalid), [invalid, onValidity]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function commit(next: PlannerState) {
    setSynced(serializeState(next).toString());
    onChange(next);
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
      // Rates unavailable (or the start is before this currency's data):
      // keep the number as typed rather than block the switch.
    }
    // Not commit(): the new amount has to replace the field's text.
    onChange({
      ...state,
      scenario: { ...state.scenario, currency: code, amount: next },
    });
  }

  /** The state with this field's value, or the error to show under it. */
  function read(
    name: Name,
    d: Draft,
  ):
    | { ok: true; next: PlannerState; note?: string }
    | { ok: false; message: string; field?: Name } {
    const s = state.scenario;
    switch (name) {
      case "amount": {
        const r = readNumberField(d.amount, {
          ...LIMITS.amount,
          range: `Enter an amount from ${formatNumberText(LIMITS.amount.min)} to ${formatNumberText(LIMITS.amount.max)}.`,
        });
        return r.ok
          ? {
              ok: true,
              next: { ...state, scenario: { ...s, amount: r.value } },
            }
          : r;
      }
      case "tranches": {
        const max = maxTranches(s.startDate, s.deadline);
        const r = readNumberField(d.tranches, {
          min: 1,
          max,
          integer: true,
          range: tranchesRange(s.startDate, s.deadline),
        });
        return r.ok
          ? {
              ok: true,
              next: { ...state, scenario: { ...s, tranches: r.value } },
            }
          : r;
      }
      case "spread": {
        const r = readNumberField(d.spread, {
          min: LIMITS.spreadPct.min,
          max: LIMITS.spreadPct.max,
          range: `Enter ${LIMITS.spreadPct.min}–${LIMITS.spreadPct.max}%.`,
        });
        return r.ok
          ? {
              ok: true,
              next: { ...state, scenario: { ...s, spread: r.value / 100 } },
            }
          : r;
      }
      case "target": {
        const r = readNumberField(d.target, {
          min: LIMITS.targetPct.min,
          max: LIMITS.targetPct.max,
          range: `Enter ${LIMITS.targetPct.min}–${LIMITS.targetPct.max}%.`,
        });
        return r.ok
          ? { ok: true, next: { ...state, targetBelowSpot: r.value / 100 } }
          : r;
      }
      case "startDate":
      case "deadline": {
        if (!ISO.test(d[name])) return { ok: false, message: "Pick a date." };
        const start = d.startDate;
        const deadline = d.deadline;
        // A rule about one date goes under that date; a rule about the pair
        // goes under the one being edited.
        const pair = windowError(start, deadline);
        if (pair) return { ok: false, message: pair };
        const page = checkDates?.(start, deadline);
        if (page)
          return { ok: false, message: page.message, field: page.field };
        // A shorter plan has room for fewer conversions (3 days apart).
        const room = maxTranches(start, deadline);
        const tranches = Math.min(s.tranches, room);
        return {
          ok: true,
          next: {
            ...state,
            scenario: { ...s, startDate: start, deadline, tranches },
          },
          note:
            tranches < s.tranches
              ? `Lowered to ${tranches}: conversions are at least 3 days apart.`
              : undefined,
        };
      }
    }
  }

  function update(name: Name, value: string) {
    const d = { ...draft, [name]: value };
    setDraft(d);
    if (timer.current) clearTimeout(timer.current);
    const r = read(name, d);
    const dates = name === "startDate" || name === "deadline";
    if (!r.ok) {
      const field = r.field ?? name;
      // Fixing one date can clear the other's error.
      setErrors((e) => ({
        ...e,
        ...(dates ? { startDate: undefined, deadline: undefined } : {}),
        [field]: r.message,
      }));
      return;
    }
    setErrors((e) => ({
      ...e,
      [name]: undefined,
      ...(dates ? { startDate: undefined, deadline: undefined } : {}),
    }));
    if (dates) {
      // A picked date is complete: use it at once.
      if (r.note) {
        setNote(r.note);
        setDraft({ ...d, tranches: String(r.next.scenario.tranches) });
      }
      commit(r.next);
      return;
    }
    timer.current = setTimeout(() => commit(r.next), COMMIT_DELAY_MS);
  }

  /** Leaving a field uses its value at once and tidies its text. */
  function blur(name: Name) {
    setFocused(null);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      const r = read(name, draft);
      if (r.ok) commit(r.next);
    }
    if (name === "amount" && !errors.amount) {
      const r = readNumberField(draft.amount, { ...LIMITS.amount, range: "" });
      if (r.ok) setDraft((d) => ({ ...d, amount: formatNumberText(r.value) }));
    }
  }

  const shownError = (name: Name) =>
    errors[name] ??
    (dateIssue && dateIssue.field === name ? dateIssue.message : undefined);

  const field = (name: Name) => {
    const error = shownError(name);
    return {
      id: `${id}-${name}`,
      value: draft[name],
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${id}-${name}-error` : `${id}-${name}-help`,
    };
  };

  const errorText = (name: Name) => {
    const error = shownError(name);
    return error ? (
      <p
        id={`${id}-${name}-error`}
        className="text-sm text-destructive"
        data-testid={`error-${name}`}
      >
        {error}
      </p>
    ) : null;
  };

  const s = state.scenario;
  const currency = pendingCurrency ?? s.currency;
  const chips = variant === "chips";
  const cost = spot === undefined ? undefined : todayCost(s, spot);
  const conversions = `${s.tranches} conversion${s.tranches === 1 ? "" : "s"}`;
  // The amount as read, while the text is written another way ("15000").
  const amountRead = readNumberField(draft.amount, {
    ...LIMITS.amount,
    range: "",
  });
  const echo =
    focused === "amount" &&
    amountRead.ok &&
    formatNumberText(amountRead.value) !== draft.amount.trim()
      ? `= ${currency} ${formatNumberText(amountRead.value)}`
      : undefined;
  const deadlineMin = ISO.test(draft.startDate)
    ? addDays(draft.startDate, MIN_WINDOW_DAYS)
    : undefined;
  const deadlineMax = ISO.test(draft.startDate)
    ? latestDeadline(draft.startDate)
    : undefined;

  return (
    <form
      className={chips ? "max-w-3xl space-y-2" : "space-y-6"}
      onSubmit={(e) => e.preventDefault()}
      aria-label="Scenario"
    >
      {/* Two groups so a phone wraps "by [date]" onto its own line, never
          mid-group; wider screens keep the sentence on one line. */}
      <p
        className={`flex flex-wrap items-center gap-x-2.5 gap-y-2 text-ink ${
          chips ? "text-[18px] font-medium" : "t-data-m"
        }`}
      >
        <span className="flex flex-wrap items-center gap-2 whitespace-nowrap">
          I need
          <input
            {...field("amount")}
            onChange={(e) => update("amount", e.target.value)}
            onFocus={() => setFocused("amount")}
            onBlur={() => blur("amount")}
            aria-describedby={
              shownError("amount")
                ? `${id}-amount-error`
                : echo
                  ? `${id}-amount-echo`
                  : undefined
            }
            aria-label={`Amount needed (${s.currency})`}
            inputMode="decimal"
            type="text"
            autoComplete="off"
            spellCheck={false}
            className="field-chip text-right tabular-nums"
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
            onChange={(e) => update("deadline", e.target.value)}
            onFocus={() => setFocused("deadline")}
            onBlur={() => blur("deadline")}
            aria-describedby={
              shownError("deadline") ? `${id}-deadline-error` : undefined
            }
            aria-label="Needed by"
            type="date"
            min={deadlineMin}
            max={deadlineMax}
            // Sized to the date it shows, so the sentence fits on one line.
            className="field-chip w-[calc(9.2em+1.75rem)] tabular-nums"
          />
        </span>
      </p>
      {errorText("amount")}
      {echo && !shownError("amount") && (
        <p
          id={`${id}-amount-echo`}
          className="text-sm text-muted-foreground tabular-nums"
          data-testid="amount-echo"
        >
          {echo}
        </p>
      )}
      {errorText("deadline")}

      {!chips && (
        // The baseline every strategy is measured against: converting it all
        // on the start date (equal to the All at once result). Same height
        // loaded or not.
        <div className="border-t pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <p className="t-label" data-testid="convert-when">
              {noCost
                ? "Converting it all"
                : `Converting it all ${convertWhen}`}
            </p>
            {noCost ? (
              <p className="t-data-m text-muted-foreground">–</p>
            ) : cost ? (
              <p className="t-data-m tabular-nums" data-testid="today-cost">
                {formatSgdAt(cost.withSpread, cost.withSpread)}
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
              `${formatSgdAt(cost.mid, cost.withSpread)} at mid rate, before your ${pctText(s.spread)}% spread`}
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
            {/* Hedging uses only the start date and spread, so its summary
                and fields leave out the planner-only settings. */}
            {chips
              ? `from ${formatDate(s.startDate)}, ${pctText(s.spread)}% spread`
              : `${conversions}, from ${formatDate(s.startDate)}, ${pctText(s.spread)}% spread, ${pctText(state.targetBelowSpot)}% target`}
          </span>
          <ChevronDown
            aria-hidden
            className={`ml-auto size-4 shrink-0 text-muted-foreground transition-transform ${
              moreOpen ? "rotate-180" : ""
            }`}
          />
        </summary>
        <div className="grid gap-x-4 gap-y-4 pt-3 pb-1 sm:grid-cols-2">
          {!chips && (
            <Field
              id={`${id}-tranches`}
              label="Most conversions you'd make"
              help={note ?? "Used by the equal-tranches strategy."}
              error={errorText("tranches")}
            >
              <input
                {...field("tranches")}
                onChange={(e) => update("tranches", e.target.value)}
                onFocus={() => setFocused("tranches")}
                onBlur={() => blur("tranches")}
                inputMode="numeric"
                type="text"
                autoComplete="off"
                className="field-input"
              />
            </Field>
          )}
          <Field
            id={`${id}-startDate`}
            label="Start converting from"
            help="The first day of your plan."
            error={errorText("startDate")}
          >
            <input
              {...field("startDate")}
              onChange={(e) => update("startDate", e.target.value)}
              onFocus={() => setFocused("startDate")}
              onBlur={() => blur("startDate")}
              type="date"
              min={startRange?.min}
              max={startRange?.max}
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
              onChange={(e) => update("spread", e.target.value)}
              onFocus={() => setFocused("spread")}
              onBlur={() => blur("spread")}
              inputMode="decimal"
              type="text"
              autoComplete="off"
              className="field-input"
            />
          </Field>
          {!chips && (
            <Field
              id={`${id}-target`}
              label="Target: % below the starting rate"
              help="Used by the target-rate strategy."
              error={errorText("target")}
            >
              <input
                {...field("target")}
                onChange={(e) => update("target", e.target.value)}
                onFocus={() => setFocused("target")}
                onBlur={() => blur("target")}
                inputMode="decimal"
                type="text"
                autoComplete="off"
                className="field-input"
              />
            </Field>
          )}
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
