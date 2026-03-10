/**
 * Export utilities: Generate CSV and PDF reports.
 */

import type { BudgetSchema } from "./schema-validator";
import { CURRENCIES } from "./currencies";
import type { CurrencyCode } from "./currencies";

function formatValue(cents: number, cfg: { symbol: string; minorUnitsPerMajor: number }): string {
  const decimals = cfg.minorUnitsPerMajor === 1 ? 0 : 2;
  return (cents / cfg.minorUnitsPerMajor).toFixed(decimals);
}

export function generateCSV(budget: BudgetSchema, currency: CurrencyCode = "USD"): string {
  const cfg = CURRENCIES[currency];
  const header = `Category,Amount (${cfg.symbol}),Percentage`;
  const total = budget.totalCents;
  const allocated = budget.categories.reduce((s, c) => s + c.allocatedCents, 0);
  const remaining = total - allocated;

  const rows = budget.categories.map((c) => {
    const pct = total > 0 ? ((c.allocatedCents / total) * 100).toFixed(1) : "0";
    const value = formatValue(c.allocatedCents, cfg);
    return `"${c.name.replace(/"/g, '""')}",${value},${pct}%`;
  });

  const totalValue = formatValue(total, cfg);
  const allocatedValue = formatValue(allocated, cfg);
  const remainingValue = formatValue(remaining, cfg);
  const allocatedPct = total > 0 ? ((allocated / total) * 100).toFixed(1) : "0";
  const remainingPct = total > 0 ? ((remaining / total) * 100).toFixed(1) : "0";

  const allocatedRow = `"ALLOCATED",${allocatedValue},${allocatedPct}%`;
  const remainingRow = `"REMAINING",${remainingValue},${remainingPct}%`;
  const totalRow = `"TOTAL",${totalValue},100%`;

  return [header, ...rows, allocatedRow, remainingRow, totalRow].join("\n");
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
