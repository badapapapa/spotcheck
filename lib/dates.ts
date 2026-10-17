// Browser-side date helpers. The engine never reads the clock; the UI does,
// once, to default the start date to today in Singapore.

import { addMonths } from "@/engine/calendar.ts";
import type { ISODate } from "@/engine/types.ts";

/** Today's date in Singapore (UTC+8, no daylight saving). */
export function todayInSingapore(now: Date = new Date()): ISODate {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** Default deadline: the 1st of the month, 10 months after `start`. */
export function defaultDeadline(start: ISODate): ISODate {
  return addMonths(start, 10).slice(0, 8) + "01";
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** '2027-08-01' → '1 Aug 2027' (formatted from the string, no time zones). */
export function formatDate(date: ISODate): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** '2027-08-01' → 'Aug 2027' */
export function formatMonth(date: ISODate): string {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}
