// Wording tied to the plan's start date. "Today" and "latest" are only true
// when the plan starts on the newest rate in the data; a link to a past
// start (2 Jan 2025) is priced at that day's rate, and a future start uses
// the latest rate because the real one isn't known yet.

import { daysBetween } from "@/engine/calendar.ts";
import type { ISODate } from "@/engine/types.ts";
import { formatDate } from "./dates.ts";

export type StartContext =
  | { kind: "latest"; rateDate: ISODate }
  | { kind: "past"; start: ISODate; rateDate: ISODate }
  | { kind: "future"; start: ISODate; rateDate: ISODate };

/**
 * `rateDate` is the date of the rate the plan uses (the last one on or
 * before the start), `lastDate` the newest date in the data and `today` the
 * date in Singapore.
 */
export function startContext(
  start: ISODate,
  rateDate: ISODate,
  lastDate: ISODate,
  today: ISODate,
): StartContext {
  if (start > today) return { kind: "future", start, rateDate };
  if (rateDate < lastDate) return { kind: "past", start, rateDate };
  return { kind: "latest", rateDate };
}

/** "today" / "on 2 Jan 2025" / "at the latest rate": when everything is converted. */
export function convertWhen(c: StartContext): string {
  if (c.kind === "latest") return "today";
  if (c.kind === "past") return `on ${formatDate(c.start)}`;
  return "at the latest rate";
}

/** The rate every period is rescaled to: "the latest rate" / "the rate on 2 Jan 2025". */
export function rescaledTo(c: StartContext): string {
  if (c.kind === "latest") return "the latest rate";
  if (c.kind === "past") return `the rate on ${formatDate(c.start)}`;
  return "the latest rate";
}

/** The line under the evidence heading naming the rate used. */
export function rateLine(c: StartContext, rate: string, code: string): string {
  const r = `${rate} SGD per ${code}`;
  if (c.kind === "latest")
    return `Latest mid rate: ${r} (${formatDate(c.rateDate)}).`;
  if (c.kind === "past")
    return c.rateDate === c.start
      ? `Mid rate on ${formatDate(c.start)}: ${r}.`
      : `Mid rate for ${formatDate(c.start)}: ${r} (the last rate before it, ${formatDate(c.rateDate)}).`;
  return `Latest mid rate: ${r} (${formatDate(c.rateDate)}), used for a start on ${formatDate(c.start)}.`;
}

/** The All at once sentence of the plain-words summary. */
export function lumpSumSentence(c: StartContext, cost: string): string {
  if (c.kind === "latest")
    return `All at once: ${cost} at the latest mid rate plus your exchange fee, known today, so it has no range.`;
  if (c.kind === "past")
    return `All at once: ${cost} at the mid rate on ${formatDate(c.rateDate)} plus your exchange fee, known on that day, so it has no range.`;
  return `All at once: ${cost} at the latest mid rate (${formatDate(c.rateDate)}) plus your exchange fee, so it has no range. The rate on ${formatDate(c.start)} isn't known yet.`;
}

/** Hedging: "today's spot" / "the spot on 2 Jan 2025" / "the latest spot". */
export function spotWhen(c: StartContext): string {
  if (c.kind === "latest") return "today's spot";
  if (c.kind === "past") return `the spot on ${formatDate(c.rateDate)}`;
  return "the latest spot";
}

/** Hedging section label: "Fixing the rate today" and its variants. */
export function fixingLabel(c: StartContext): string {
  if (c.kind === "latest") return "Fixing the rate today";
  if (c.kind === "past") return `Fixing the rate on ${formatDate(c.rateDate)}`;
  return `Fixing the rate at the latest prices (${formatDate(c.rateDate)})`;
}

/** A short note when the deadline has already passed, else undefined. */
export function pastDeadlineNote(
  deadline: ISODate,
  today: ISODate,
): string | undefined {
  if (daysBetween(today, deadline) >= 0) return undefined;
  return `Your deadline, ${formatDate(deadline)}, has passed. The figures show how the same plan compared across history.`;
}
