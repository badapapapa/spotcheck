// Daily SORA and MAS's published compounded SORA (1M/3M/6M), from the MAS
// "Domestic Interest Rates" statistics page. That page has no JSON API, so we
// submit its form the way a browser would and read the CSV it returns.
// No API key.

import { fetchWithRetry } from "./http.ts";
import type { SoraRow } from "./schemas.ts";

const PAGE_URL =
  "https://eservices.mas.gov.sg/Statistics/dir/DomesticInterestRates.aspx";

export const MAS_SOURCE =
  "Monetary Authority of Singapore, Domestic Interest Rates (SORA), " +
  PAGE_URL;

/** Index of each column in the page's "columns to show" checkbox list, and its label. */
const COLUMNS = {
  sora: [13, "SORA"],
  compounded1m: [15, "1-month Compounded SORA"],
  compounded3m: [16, "3-month Compounded SORA"],
  compounded6m: [17, "6-month Compounded SORA"],
} as const;

const FIELD_PREFIX = "ctl00$ContentPlaceHolder1$";
const REQUIRED_FIELDS = [
  "StartYearDropDownList",
  "StartMonthDropDownList",
  "EndYearDropDownList",
  "EndMonthDropDownList",
  "Button2",
] as const;

/**
 * Checks the form still looks the way this fetcher expects before submitting
 * it: every field we set exists and each checkbox still has the label we
 * think it has. If MAS redesigns the page, this fails with a clear message
 * instead of downloading the wrong columns or a default date range.
 */
export function assertFormShape(html: string): void {
  const problems: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!html.includes(`name="${FIELD_PREFIX}${field}"`))
      problems.push(`field ${field} missing`);
  }
  for (const [index, label] of Object.values(COLUMNS)) {
    const m = html.match(
      new RegExp(
        `<label[^>]*for="ContentPlaceHolder1_ColumnsCheckBoxList_${index}"[^>]*>([^<]*)<`,
      ),
    );
    if (m?.[1]?.trim() !== label) {
      problems.push(
        `checkbox ${index} is "${m?.[1]?.trim() ?? "missing"}", expected "${label}"`,
      );
    }
  }
  if (!/name="__VIEWSTATE"/.test(html))
    problems.push("ASP.NET __VIEWSTATE missing");
  if (problems.length) {
    throw new Error(
      `MAS form has changed; update scripts/fetch/mas.ts. ${problems.join("; ")}`,
    );
  }
}

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

/** '04 Aug 2020' → '2020-08-04' */
function parseLongDate(s: string): string {
  const [day, mon, year] = s.trim().split(/\s+/);
  const mm = mon ? MONTHS[mon] : undefined;
  if (!day || !mm || !year) throw new Error(`Bad MAS date '${s}'`);
  return `${year}-${mm}-${day.padStart(2, "0")}`;
}

/** MAS publishes percentages ('0.1313'); store decimals. '-' means none. */
function parsePercent(s: string | undefined): number | null {
  const t = (s ?? "").trim();
  if (t === "" || t === "-") return null;
  const v = Number(t);
  if (!Number.isFinite(v)) throw new Error(`Bad MAS rate '${s}'`);
  return Number((v / 100).toFixed(8));
}

/**
 * Parses the MAS CSV. The value date is split over three columns, and year
 * and month are only filled on the first row they apply to.
 */
export function parseMasCsv(csv: string): SoraRow[] {
  const lines = csv.split(/\r?\n/);
  const header = lines.findIndex((l) => l.startsWith("SORA Value Date"));
  if (header < 0) throw new Error("MAS CSV: header row not found");
  const expected =
    "SORA Value Date,,,SORA Publication Date,SORA," +
    "Compound SORA - 1 month,Compound SORA - 3 month,Compound SORA - 6 month";
  if (lines[header]!.trim() !== expected) {
    throw new Error(`MAS CSV: unexpected columns '${lines[header]}'`);
  }
  const rows: SoraRow[] = [];
  let year = "";
  let month = "";
  for (const line of lines.slice(header + 1)) {
    if (line.trim() === "") break; // data ends at the first blank line
    const [y, m, d, pub, sora, c1, c3, c6] = line.split(",");
    if (y) year = y.trim();
    if (m) month = MONTHS[m.trim()] ?? "";
    if (!year || !month || !d) throw new Error(`MAS CSV: bad row '${line}'`);
    const soraValue = parsePercent(sora);
    if (soraValue === null) throw new Error(`MAS CSV: missing SORA '${line}'`);
    rows.push([
      `${year}-${month}-${d.trim().padStart(2, "0")}`,
      parseLongDate(pub ?? ""),
      soraValue,
      parsePercent(c1),
      parsePercent(c3),
      parsePercent(c6),
    ]);
  }
  return rows;
}

/** Downloads one CSV for the months [fromYear/fromMonth, toYear/toMonth]. */
async function downloadCsv(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): Promise<string> {
  const page = await fetchWithRetry(PAGE_URL);
  const cookie = page.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const html = await page.text();
  assertFormShape(html);

  const form = new URLSearchParams();
  // ASP.NET needs its hidden state fields echoed back.
  for (const m of html.matchAll(
    /<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"/g,
  )) {
    form.set(m[1]!, m[2]!);
  }
  const p = FIELD_PREFIX;
  form.set(`${p}StartYearDropDownList`, String(fromYear));
  form.set(`${p}StartMonthDropDownList`, String(fromMonth));
  form.set(`${p}EndYearDropDownList`, String(toYear));
  form.set(`${p}EndMonthDropDownList`, String(toMonth));
  for (const [index] of Object.values(COLUMNS)) {
    form.set(`${p}ColumnsCheckBoxList$${index}`, "on");
  }
  form.set(`${p}Button2`, "Download");

  const res = await fetchWithRetry(PAGE_URL, {
    method: "POST",
    body: form,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
    },
  });
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("text/csv")) {
    throw new Error(
      `MAS returned '${type}' instead of CSV; the form may have changed`,
    );
  }
  return res.text();
}

/** Fetches SORA rows whose value date falls in [from, to], a year at a time. */
export async function fetchSora(from: string, to: string): Promise<SoraRow[]> {
  const rows: SoraRow[] = [];
  const startYear = Number(from.slice(0, 4));
  const endYear = Number(to.slice(0, 4));
  for (let year = startYear; year <= endYear; year++) {
    const fromMonth = year === startYear ? Number(from.slice(5, 7)) : 1;
    const toMonth = year === endYear ? Number(to.slice(5, 7)) : 12;
    rows.push(
      ...parseMasCsv(await downloadCsv(year, fromMonth, year, toMonth)),
    );
  }
  return rows.filter(([date]) => date >= from && date <= to);
}
