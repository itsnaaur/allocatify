/**
 * Month-by-month history for the Trends section: where each month's income went,
 * and how much is still owed on loans.
 */

import type { BudgetSchema } from "./schema-validator";
import { buildMonthReport, type PlannerData } from "./report";

export interface TrendPoint {
  monthKey: string;
  incomeCents: number; // income + carried in
  fixedCents: number; // loans & bills due
  spendingCents: number; // logged where tracked, planned where not
  savedCents: number; // goal savings recorded
  leftCents: number; // left over, including any moved to the next month
  overspentCents: number; // spent beyond income (0 normally)
  /** Still owed on loans after this month; null before any loan has started. */
  debtCents: number | null;
  tracked: boolean; // any expense logged this month
}

export function buildTrends(budgets: BudgetSchema[], data: PlannerData, maxMonths = 12): TrendPoint[] {
  const sorted = [...budgets].sort((a, b) =>
    (a.monthKey ?? a.id).localeCompare(b.monthKey ?? b.id)
  );
  return sorted.slice(-maxMonths).map((b) => {
    const r = buildMonthReport(b, data);
    const spendingCents = r.totals.countedSpendingCents;
    const incomeCents = r.incomeCents + r.carryInCents;
    const used = r.totals.fixedDueCents + spendingCents + r.totals.goalSavedCents;
    return {
      monthKey: r.monthKey,
      incomeCents,
      fixedCents: r.totals.fixedDueCents,
      spendingCents,
      savedCents: r.totals.goalSavedCents,
      leftCents: Math.max(0, incomeCents - used),
      overspentCents: Math.max(0, used - incomeCents),
      debtCents: r.fixed.some((f) => f.kind === "loan")
        ? r.fixed.reduce((s, f) => s + (f.remainingCents ?? 0), 0)
        : null,
      tracked: r.expenses.length > 0,
    };
  });
}
