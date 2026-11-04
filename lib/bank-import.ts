/**
 * Bank statement CSV → expenses. Banks format exports differently, so columns, date
 * order, decimal commas and debit/credit signs are detected, and the user can correct
 * any guess before importing. Pure functions only.
 */

import { parseCsvRows } from "./csv";
import type { Expense } from "./finance";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

export type DateOrder = "YMD" | "MDY" | "DMY";
export type SignMode = "negatives" | "all";

export interface ColumnGuess {
  date: number;
  amount: number;
  description: number;
}

export interface BankTable {
  headers: string[];
  rows: string[][];
}

export function readBankCsv(text: string): BankTable | { error: string } {
  const all = parseCsvRows(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (all.length < 2) return { error: "This file has no rows to import." };
  // Some banks put account info above the real header (often padded with commas):
  // the header is the first row, as wide as the data, with (nearly) every column named.
  const width = mode(all.map((r) => r.length));
  const named = (r: string[]) => r.filter((c) => c.trim() !== "").length;
  const found = all.findIndex((r) => r.length >= width && named(r) >= Math.max(2, width - 1));
  const headerIndex = found >= 0 ? found : 0;
  const headers = all[headerIndex].map((h) => h.trim());
  const rows = all.slice(headerIndex + 1).filter((r) => r.length >= 2);
  if (rows.length === 0) return { error: "This file has a header but no transactions." };
  if (rows.length > MAX_IMPORT_ROWS)
    return { error: `This file has more than ${MAX_IMPORT_ROWS} rows. Export a shorter date range.` };
  return { headers, rows };
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

const DATE_HEADER = /date|posted|booking|datum|fecha|data|day/i;
const AMOUNT_HEADER = /amount|debit|withdraw|spent|value|sum|betrag|monto|importe|valor/i;
const DEBIT_HEADER = /debit|withdraw|money out|paid out|outflow/i;
const DESC_HEADER = /desc|detail|payee|merchant|memo|narrat|name|text|reference|particular|remark|transaction/i;

export function guessColumns(table: BankTable): ColumnGuess {
  const { headers, rows } = table;
  const sample = rows.slice(0, 30);
  // Judge a column by its filled cells (a debit column is blank on income rows).
  const share = (i: number, test: (v: string) => boolean) => {
    const filled = sample.filter((r) => (r[i] ?? "").trim() !== "");
    return filled.length === 0 ? 0 : filled.filter((r) => test(r[i].trim())).length / filled.length;
  };
  const cols = headers.map((h, i) => ({
    i,
    h,
    dates: share(i, (v) => splitDate(v) !== null),
    amounts: share(i, (v) => parseBankAmount(v) !== null),
  }));

  const date =
    cols.find((c) => DATE_HEADER.test(c.h) && c.dates > 0.6)?.i ??
    [...cols].sort((a, b) => b.dates - a.dates)[0].i;
  const amountCandidates = cols.filter((c) => c.i !== date && c.amounts > 0.6);
  const amount =
    amountCandidates.find((c) => DEBIT_HEADER.test(c.h))?.i ??
    amountCandidates.find((c) => AMOUNT_HEADER.test(c.h) && !/balance/i.test(c.h))?.i ??
    amountCandidates.find((c) => !/balance/i.test(c.h))?.i ??
    amountCandidates[0]?.i ??
    (date === 0 ? 1 : 0);
  const description =
    cols.find((c) => c.i !== date && c.i !== amount && DESC_HEADER.test(c.h))?.i ??
    cols.find((c) => c.i !== date && c.i !== amount && c.amounts < 0.5 && c.dates < 0.5)?.i ??
    -1;
  return { date, amount, description };
}

/** Split a date into three numbers in the order written, or null. */
function splitDate(v: string): [number, number, number] | null {
  const m = v.trim().match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?:[ T].*)?$/);
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  return parts.some((n) => !Number.isFinite(n)) ? null : parts;
}

/** Which order the dates are written in. `certain` is false when every date fits both. */
export function guessDateOrder(values: string[]): { order: DateOrder; certain: boolean } {
  let firstBig = false;
  let secondBig = false;
  let yearFirst = false;
  for (const v of values) {
    const p = splitDate(v);
    if (!p) continue;
    if (p[0] > 31) yearFirst = true;
    else {
      if (p[0] > 12) firstBig = true;
      if (p[1] > 12) secondBig = true;
    }
  }
  if (yearFirst) return { order: "YMD", certain: true };
  if (firstBig && !secondBig) return { order: "DMY", certain: true };
  if (secondBig && !firstBig) return { order: "MDY", certain: true };
  return { order: "DMY", certain: false };
}

/** "YYYY-MM-DD" or null. Two-digit years are taken as 20xx. */
export function parseBankDate(v: string, order: DateOrder): string | null {
  const p = splitDate(v);
  if (!p) return null;
  let [y, m, d] = order === "YMD" ? p : order === "MDY" ? [p[2], p[0], p[1]] : [p[2], p[1], p[0]];
  if (y < 100) y += 2000;
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return null;
  const days = new Date(y, m, 0).getDate();
  if (d > days) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Amount in major units with sign, or null. Handles "$1,234.56", "-1.234,56",
 * "(12.50)", "12.50 DR" / "CR", "1 234,56" and trailing minus "12.50-".
 */
export function parseBankAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/\bDR\b/i.test(s)) negative = true;
  s = s.replace(/\b(DR|CR)\b/gi, "");
  if (/-\s*$/.test(s) || /^\s*-/.test(s) || /^[^\d]*-/.test(s)) negative = true;
  s = s.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot && /,\d{1,2}$/.test(s)) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = s.replace(/,/g, "");
  }
  if ((normalized.match(/\./g) ?? []).length > 1) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export interface ImportRow {
  date: string;
  monthKey: string;
  description: string;
  amountCents: number;
  duplicate: boolean;
}

export interface ImportPlan {
  rows: ImportRow[];
  skippedCredits: number;
  skippedInvalid: number;
}

export function planImport(
  table: BankTable,
  options: {
    columns: ColumnGuess;
    dateOrder: DateOrder;
    signMode: SignMode;
    minorUnitsPerMajor: number;
    existing: Pick<Expense, "date" | "amountCents" | "note">[];
  }
): ImportPlan {
  const { columns, dateOrder, signMode, minorUnitsPerMajor } = options;
  const seen = new Set(
    options.existing.map((e) => `${e.date}|${e.amountCents}|${(e.note ?? "").toLowerCase()}`)
  );
  const rows: ImportRow[] = [];
  let skippedCredits = 0;
  let skippedInvalid = 0;
  for (const r of table.rows) {
    // A blank amount in a debit column is money coming in.
    if ((r[columns.amount] ?? "").trim() === "" && parseBankDate(r[columns.date] ?? "", dateOrder)) {
      skippedCredits++;
      continue;
    }
    const date = parseBankDate(r[columns.date] ?? "", dateOrder);
    const amount = parseBankAmount(r[columns.amount] ?? "");
    if (!date || amount === null || amount === 0) {
      skippedInvalid++;
      continue;
    }
    if (signMode === "negatives" && amount > 0) {
      skippedCredits++;
      continue;
    }
    const amountCents = Math.round(Math.abs(amount) * minorUnitsPerMajor);
    const description = (columns.description >= 0 ? r[columns.description] ?? "" : "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    const key = `${date}|${amountCents}|${description.toLowerCase()}`;
    const duplicate = seen.has(key);
    seen.add(key);
    rows.push({ date, monthKey: date.slice(0, 7), description, amountCents, duplicate });
  }
  return { rows, skippedCredits, skippedInvalid };
}

/** Default sign handling: if any amount is negative, negatives are spending. */
export function guessSignMode(table: BankTable, amountColumn: number): SignMode {
  return table.rows.some((r) => (parseBankAmount(r[amountColumn] ?? "") ?? 0) < 0)
    ? "negatives"
    : "all";
}
