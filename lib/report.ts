/**
 * One month, put together for exports (CSV and PDF): income, loans & bills, spending
 * planned vs actual, goals and the expense list. Pure, so it can be tested.
 */

import type { BudgetSchema } from "./schema-validator";
import {
  monthLeftover,
  obligationDueInMonth,
  spentByCategory,
  type Contribution,
  type Expense,
  type Goal,
  type Obligation,
  type Payment,
} from "./finance";
import { formatMonthKey } from "./month-utils";

export interface PlannerData {
  obligations: Obligation[];
  payments: Payment[];
  goals: Goal[];
  contributions: Contribution[];
  expenses: Expense[];
}

export interface FixedLine {
  name: string;
  kind: "loan" | "bill";
  dueDay: number;
  dueCents: number;
  paidCents: number | null;
  /** Loans: still owed after this month's payment, and months left from then. */
  remainingCents?: number;
  monthsLeft?: number;
}

export interface CategoryLine {
  name: string;
  plannedCents: number;
  /** null when nothing was logged for it. */
  spentCents: number | null;
  essential: boolean;
}

export interface GoalLine {
  name: string;
  targetCents: number;
  savedThisMonthCents: number;
  savedToDateCents: number;
}

export interface ExpenseLine {
  date: string;
  description: string;
  category: string;
  amountCents: number;
}

export interface MonthReport {
  monthKey: string;
  name: string;
  incomeCents: number;
  incomeSources: { name: string; amountCents: number }[];
  carryInCents: number;
  carryInFrom: string | null;
  fixed: FixedLine[];
  categories: CategoryLine[];
  uncategorizedSpentCents: number;
  goals: GoalLine[];
  expenses: ExpenseLine[];
  carryOutCents: number;
  totals: {
    fixedDueCents: number;
    fixedPaidCents: number;
    plannedSpendingCents: number;
    actualSpendingCents: number;
    goalSavedCents: number;
    /** Left at the end: logged spending where tracked, planned where not. */
    leftCents: number;
  };
}

export function buildMonthReport(budget: BudgetSchema, data: PlannerData): MonthReport {
  const monthKey = budget.monthKey ?? budget.id;

  const fixed: FixedLine[] = [];
  for (const ob of data.obligations) {
    const payment = data.payments.find((p) => p.obligationId === ob.id && p.monthKey === monthKey);
    const due = obligationDueInMonth(ob, monthKey, data.payments);
    if (due <= 0 && !payment) continue;
    const line: FixedLine = {
      name: ob.name,
      kind: ob.kind,
      dueDay: ob.dueDay,
      dueCents: payment?.amountCents ?? due,
      paidCents: payment ? payment.amountCents : null,
    };
    if (ob.kind === "loan") {
      const paidThrough = data.payments
        .filter((p) => p.obligationId === ob.id && p.monthKey <= monthKey)
        .reduce((s, p) => s + p.amountCents, 0);
      const remaining = Math.max(0, (ob.totalOwedCents ?? 0) - paidThrough);
      line.remainingCents = remaining;
      line.monthsLeft = ob.monthlyCents > 0 ? Math.ceil(remaining / ob.monthlyCents) : 0;
    }
    fixed.push(line);
  }
  fixed.sort((a, b) => a.dueDay - b.dueDay);

  const spent = spentByCategory(data.expenses, monthKey);
  const categories: CategoryLine[] = budget.categories.map((c) => ({
    name: c.name,
    plannedCents: c.allocatedCents,
    spentCents: spent.has(c.id) ? spent.get(c.id)! : null,
    essential: !!c.essential,
  }));
  const known = new Set(budget.categories.map((c) => c.id));
  let uncategorizedSpentCents = 0;
  spent.forEach((amount, id) => {
    if (!known.has(id)) uncategorizedSpentCents += amount;
  });

  const goals: GoalLine[] = data.goals.map((g) => {
    const mine = data.contributions.filter((c) => c.goalId === g.id);
    return {
      name: g.name,
      targetCents: g.targetCents,
      savedThisMonthCents: mine
        .filter((c) => c.monthKey === monthKey)
        .reduce((s, c) => s + c.amountCents, 0),
      savedToDateCents: mine
        .filter((c) => c.monthKey <= monthKey)
        .reduce((s, c) => s + c.amountCents, g.startingSavedCents),
    };
  });

  const names = new Map(budget.categories.map((c) => [c.id, c.name]));
  const expenses: ExpenseLine[] = data.expenses
    .filter((e) => e.monthKey === monthKey)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((e) => {
      const category = (e.categoryId && names.get(e.categoryId)) || "Uncategorized";
      return {
        date: e.date,
        description: e.note || category,
        category,
        amountCents: e.amountCents,
      };
    });

  const fixedDueCents = fixed.reduce((s, f) => s + f.dueCents, 0);
  const goalSavedCents = goals.reduce((s, g) => s + g.savedThisMonthCents, 0);
  const incomeSources = budget.incomeSources?.length
    ? budget.incomeSources.map((s) => ({ name: s.name, amountCents: s.amountCents }))
    : [{ name: "Monthly income", amountCents: budget.totalCents }];

  return {
    monthKey,
    name: budget.name || formatMonthKey(monthKey),
    incomeCents: budget.totalCents,
    incomeSources,
    carryInCents: budget.carryInCents ?? 0,
    carryInFrom: budget.carryInFrom ?? null,
    fixed,
    categories,
    uncategorizedSpentCents,
    goals,
    expenses,
    carryOutCents: budget.carryOutCents ?? 0,
    totals: {
      fixedDueCents,
      fixedPaidCents: fixed.reduce((s, f) => s + (f.paidCents ?? 0), 0),
      plannedSpendingCents: categories.reduce((s, c) => s + c.plannedCents, 0),
      actualSpendingCents:
        categories.reduce((s, c) => s + (c.spentCents ?? 0), 0) + uncategorizedSpentCents,
      goalSavedCents,
      leftCents: monthLeftover({
        incomeCents: budget.totalCents,
        carryInCents: budget.carryInCents ?? 0,
        fixedCents: fixedDueCents,
        categories: budget.categories,
        spent,
        goalSavedCents,
        carriedOutCents: budget.carryOutCents ?? 0,
      }),
    },
  };
}
