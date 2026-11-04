/**
 * Export utilities: CSV for one or more months (built from month reports), and download.
 */

import type { BudgetSchema } from "./schema-validator";
import { CURRENCIES, type CurrencyCode } from "./currencies";
import { formatMonthKey } from "./month-utils";
import type { MonthReport } from "./report";

/** Get monthly budgets for a year, sorted Jan → Dec. */
export function getBudgetsForYear(budgets: BudgetSchema[], year: number): BudgetSchema[] {
  const yearStr = String(year);
  return budgets
    .filter((b) => (b.monthKey ?? b.id ?? "").startsWith(yearStr + "-"))
    .sort((a, b) => (a.monthKey ?? a.id ?? "").localeCompare(b.monthKey ?? b.id ?? ""));
}

/**
 * One CSV cell. Quotes when needed, and neutralises text a spreadsheet would run as a
 * formula (=, +, -, @ at the start).
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

function money(cents: number | null | undefined, currency: CurrencyCode): string {
  if (cents === null || cents === undefined) return "";
  const minor = CURRENCIES[currency].minorUnitsPerMajor;
  return (cents / minor).toFixed(minor === 1 ? 0 : 2);
}

/** CSV for one month: overview table, then the expense list. */
export function monthReportCSV(r: MonthReport, currency: CurrencyCode): string {
  const m = (c: number | null | undefined) => money(c, currency);
  const lines: string[] = [];
  lines.push(row([r.name]));
  lines.push(row(["Section", "Item", "Planned", "Actual", "Details"]));

  for (const src of r.incomeSources)
    lines.push(row(["Income", src.name, m(src.amountCents), "", src.payDay ? `paid on day ${src.payDay}` : ""]));
  if (r.carryInCents > 0)
    lines.push(
      row([
        "Income",
        `Carried over${r.carryInFrom ? ` from ${formatMonthKey(r.carryInFrom)}` : ""}`,
        m(r.carryInCents),
        "",
        "",
      ])
    );

  for (const f of r.fixed) {
    const details = [
      f.paidCents !== null ? "Paid" : "Not paid",
      `due day ${f.dueDay}`,
      f.kind === "loan" && f.monthsLeft !== undefined
        ? `${f.monthsLeft} months left · ${m(f.remainingCents)} to go`
        : f.kind === "bill"
          ? "monthly bill"
          : "",
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(row(["Loans & bills", f.name, m(f.dueCents), m(f.paidCents), details]));
  }

  for (const c of r.categories)
    lines.push(row(["Spending", c.name, m(c.plannedCents), m(c.spentCents), c.essential ? "Must-have" : ""]));
  if (r.uncategorizedSpentCents > 0)
    lines.push(row(["Spending", "Uncategorized", "", m(r.uncategorizedSpentCents), ""]));

  for (const g of r.goals)
    lines.push(
      row([
        "Goals",
        g.name,
        "",
        m(g.savedThisMonthCents),
        `${m(g.savedToDateCents)} of ${m(g.targetCents)} saved`,
      ])
    );

  const t = r.totals;
  lines.push(row(["Summary", "Income", m(r.incomeCents + r.carryInCents), "", ""]));
  lines.push(row(["Summary", "Loans & bills", m(t.fixedDueCents), m(t.fixedPaidCents), ""]));
  lines.push(
    row([
      "Summary",
      "Spending",
      m(t.plannedSpendingCents),
      m(t.actualSpendingCents),
      `Counted toward left over: ${m(t.countedSpendingCents)}`,
    ])
  );
  lines.push(row(["Summary", "Goal savings", "", m(t.goalSavedCents), ""]));
  if (r.carryOutCents > 0)
    lines.push(row(["Summary", "Moved to next month", "", m(r.carryOutCents), ""]));
  lines.push(
    row(["Summary", "Left over", "", m(t.leftCents), "Logged spending where tracked, planned where not"])
  );

  lines.push("");
  lines.push(row([`${r.name} expenses`]));
  lines.push(row(["Date", "Description", "Category", "Amount"]));
  if (r.expenses.length === 0) lines.push(row(["", "No expenses logged", "", ""]));
  for (const e of r.expenses) lines.push(row([e.date, e.description, e.category, m(e.amountCents)]));
  return lines.join("\n");
}

export function reportsCSV(reports: MonthReport[], currency: CurrencyCode): string {
  return reports.map((r) => monthReportCSV(r, currency)).join("\n\n");
}

export function downloadCSV(content: string, filename: string) {
  // BOM so Excel reads UTF-8 currency symbols (¥, ₱, ₹) correctly.
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking immediately can cancel the download in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
