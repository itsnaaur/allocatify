/**
 * Planner math: loans & bills, savings goals and the monthly plan.
 * Pure functions only (no storage, no React) so they are easy to test.
 * All amounts are integers in the active currency's minor units.
 */

import { addMonths, daysInMonth, monthDiff } from "./month-utils";

export const MIN_BUFFER_PERCENT = 10;
export const MAX_BUFFER_PERCENT = 50;
export const DEFAULT_BUFFER_PERCENT = 10;

/** Safety buffer can be raised but never set below 10% (or above 50%). */
export function clampBufferPercent(pct: number): number {
  if (!Number.isFinite(pct)) return DEFAULT_BUFFER_PERCENT;
  return Math.min(MAX_BUFFER_PERCENT, Math.max(MIN_BUFFER_PERCENT, Math.round(pct)));
}

// ---------------------------------------------------------------------------
// Loans & bills
// ---------------------------------------------------------------------------

export type ObligationKind = "loan" | "bill";

export interface Obligation {
  id: string;
  kind: ObligationKind;
  name: string;
  /** Regular monthly payment. */
  monthlyCents: number;
  /** Day of the month it is due (1–31; clamped to short months). */
  dueDay: number;
  /** First month a payment is due ("YYYY-MM"). */
  startMonthKey: string;
  /** Loans only: total still to pay when added, interest included. */
  totalOwedCents?: number;
  createdAt: number;
}

export interface Payment {
  /** `${obligationId}_${monthKey}` — one payment per obligation per month. */
  id: string;
  obligationId: string;
  monthKey: string;
  amountCents: number;
  paidAt: number;
}

function paymentsFor(obligationId: string, payments: Payment[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of payments) {
    if (p.obligationId === obligationId) {
      map.set(p.monthKey, (map.get(p.monthKey) ?? 0) + p.amountCents);
    }
  }
  return map;
}

/**
 * Loan balance left before `monthKey`, assuming every earlier month was paid as
 * recorded, or as scheduled when nothing was recorded yet.
 */
function projectedBalanceBefore(
  ob: Obligation,
  monthKey: string,
  paid: Map<string, number>
): number {
  let remaining = ob.totalOwedCents ?? 0;
  const months = monthDiff(ob.startMonthKey, monthKey);
  for (let i = 0; i < months && remaining > 0; i++) {
    const key = addMonths(ob.startMonthKey, i);
    remaining -= paid.get(key) ?? Math.min(ob.monthlyCents, remaining);
  }
  return Math.max(0, remaining);
}

/** Amount due for an obligation in a given month (0 if not started or paid off). */
export function obligationDueInMonth(
  ob: Obligation,
  monthKey: string,
  payments: Payment[]
): number {
  if (monthDiff(ob.startMonthKey, monthKey) < 0) return 0;
  if (ob.kind === "bill") return ob.monthlyCents;
  const paid = paymentsFor(ob.id, payments);
  const balance = projectedBalanceBefore(ob, monthKey, paid);
  return Math.min(ob.monthlyCents, balance);
}

export interface LoanSummary {
  paidCents: number;
  remainingCents: number;
  monthsLeft: number;
  /** Size of the last payment (smaller than monthly when it doesn't divide evenly). */
  finalPaymentCents: number;
  /** Month of the last payment, or null when already paid off. */
  payoffMonthKey: string | null;
  isPaidOff: boolean;
}

export function loanSummary(ob: Obligation, payments: Payment[]): LoanSummary {
  const paid = paymentsFor(ob.id, payments);
  const paidCents = Array.from(paid.values()).reduce((s, v) => s + v, 0);
  const remainingCents = Math.max(0, (ob.totalOwedCents ?? 0) - paidCents);
  if (remainingCents === 0 || ob.monthlyCents <= 0) {
    return {
      paidCents,
      remainingCents,
      monthsLeft: 0,
      finalPaymentCents: 0,
      payoffMonthKey: null,
      isPaidOff: remainingCents === 0,
    };
  }
  const monthsLeft = Math.ceil(remainingCents / ob.monthlyCents);
  const finalPaymentCents = remainingCents - (monthsLeft - 1) * ob.monthlyCents;
  // First month from the start with nothing recorded is the next payment.
  let next = ob.startMonthKey;
  while (paid.has(next)) next = addMonths(next, 1);
  return {
    paidCents,
    remainingCents,
    monthsLeft,
    finalPaymentCents,
    payoffMonthKey: addMonths(next, monthsLeft - 1),
    isPaidOff: false,
  };
}

export type DueStatus =
  | { kind: "paid" }
  | { kind: "overdue"; days: number }
  | { kind: "due-today" }
  | { kind: "due-soon"; days: number }
  | { kind: "upcoming"; days: number };

/** The actual due date in a month (day 31 becomes the 30th/28th in short months). */
export function dueDateInMonth(dueDay: number, monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  const day = Math.min(Math.max(1, dueDay), daysInMonth(monthKey));
  return new Date(year, month - 1, day);
}

export function dueStatus(
  dueDay: number,
  monthKey: string,
  isPaid: boolean,
  today: Date
): DueStatus {
  if (isPaid) return { kind: "paid" };
  const due = dueDateInMonth(dueDay, monthKey);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((due.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days === 0) return { kind: "due-today" };
  if (days <= 7) return { kind: "due-soon", days };
  return { kind: "upcoming", days };
}

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------

export type GoalPriority = 1 | 2 | 3;

export interface Goal {
  id: string;
  name: string;
  targetCents: number;
  /** Already saved before tracking started. */
  startingSavedCents: number;
  /** Optional "I want it by" month. */
  deadlineMonthKey?: string;
  /** 1 = low, 2 = normal, 3 = high. Higher gets a bigger share of free money. */
  priority: GoalPriority;
  createdAt: number;
}

export interface Contribution {
  /** `${goalId}_${monthKey}` — one saving entry per goal per month. */
  id: string;
  goalId: string;
  monthKey: string;
  amountCents: number;
  savedAt: number;
}

export interface GoalPlan {
  goalId: string;
  /** Saved in total so far (including this month's recorded amount). */
  savedCents: number;
  /** Still needed, counting from the start of this month. */
  remainingBeforeMonthCents: number;
  /** What the app suggests saving this month from free money. */
  suggestedCents: number;
  /** Amount recorded as saved this month, if any. */
  savedThisMonthCents: number | null;
  /** Amount counted in this month's plan: recorded if any, else suggested. */
  plannedCents: number;
  /** Months until affordable at the suggested pace (null = can't save anything now). */
  monthsToAfford: number | null;
  affordMonthKey: string | null;
  /** Deadline check (null when no deadline). */
  deadline: null | {
    monthsAvailable: number;
    requiredMonthlyCents: number;
    feasible: boolean;
  };
  isComplete: boolean;
}

/**
 * Share free money between goals by priority, never giving a goal more than it still
 * needs; money a goal can't use is passed on to the others.
 */
export function splitFreeMoney(
  freeCents: number,
  needs: { id: string; weight: number; needCents: number }[]
): Map<string, number> {
  const result = new Map<string, number>(needs.map((n) => [n.id, 0]));
  let pool = Math.max(0, freeCents);
  let active = needs.filter((n) => n.needCents > 0 && n.weight > 0);
  while (pool > 0 && active.length > 0) {
    const totalWeight = active.reduce((s, n) => s + n.weight, 0);
    let given = 0;
    const shares = active.map((n) => Math.floor((pool * n.weight) / totalWeight));
    // Hand out rounding leftovers, highest priority first.
    let rest = pool - shares.reduce((s, v) => s + v, 0);
    const byWeight = active
      .map((n, i) => ({ i, w: n.weight }))
      .sort((a, b) => b.w - a.w || a.i - b.i);
    for (let k = 0; rest > 0; k = (k + 1) % byWeight.length, rest--) {
      shares[byWeight[k].i] += 1;
    }
    active.forEach((n, i) => {
      const room = n.needCents - (result.get(n.id) ?? 0);
      const give = Math.min(room, shares[i]);
      result.set(n.id, (result.get(n.id) ?? 0) + give);
      given += give;
    });
    pool -= given;
    active = active.filter((n) => (result.get(n.id) ?? 0) < n.needCents);
    if (given === 0) break;
  }
  return result;
}

export function planGoals(
  goals: Goal[],
  contributions: Contribution[],
  freeToSaveCents: number,
  monthKey: string
): GoalPlan[] {
  const info = goals.map((g) => {
    const mine = contributions.filter((c) => c.goalId === g.id);
    const before = mine
      .filter((c) => c.monthKey !== monthKey)
      .reduce((s, c) => s + c.amountCents, 0);
    const thisMonth = mine.find((c) => c.monthKey === monthKey)?.amountCents ?? null;
    const remainingBefore = Math.max(0, g.targetCents - g.startingSavedCents - before);
    return { g, before, thisMonth, remainingBefore };
  });

  const shares = splitFreeMoney(
    freeToSaveCents,
    info.map(({ g, remainingBefore }) => ({
      id: g.id,
      weight: g.priority,
      needCents: remainingBefore,
    }))
  );

  return info.map(({ g, before, thisMonth, remainingBefore }) => {
    const suggested = shares.get(g.id) ?? 0;
    const planned = thisMonth ?? suggested;
    const saved = g.startingSavedCents + before + (thisMonth ?? 0);
    const monthsToAfford =
      remainingBefore === 0 ? 0 : suggested > 0 ? Math.ceil(remainingBefore / suggested) : null;
    let deadline: GoalPlan["deadline"] = null;
    if (g.deadlineMonthKey) {
      const monthsAvailable = monthDiff(monthKey, g.deadlineMonthKey) + 1;
      const required =
        monthsAvailable > 0 ? Math.ceil(remainingBefore / monthsAvailable) : remainingBefore;
      deadline = {
        monthsAvailable,
        requiredMonthlyCents: required,
        feasible: monthsAvailable > 0 && required <= suggested,
      };
    }
    return {
      goalId: g.id,
      savedCents: saved,
      remainingBeforeMonthCents: remainingBefore,
      suggestedCents: suggested,
      savedThisMonthCents: thisMonth,
      plannedCents: planned,
      monthsToAfford,
      affordMonthKey:
        monthsToAfford && monthsToAfford > 0 ? addMonths(monthKey, monthsToAfford - 1) : null,
      deadline,
      isComplete: saved >= g.targetCents,
    };
  });
}

// ---------------------------------------------------------------------------
// The month
// ---------------------------------------------------------------------------

export interface MonthPlanInput {
  incomeCents: number;
  fixedCents: number; // loans + bills due this month
  essentialCents: number; // must-have categories
  otherSpendingCents: number; // non-essential categories
  bufferPercent: number;
}

export interface MonthPlan {
  incomeCents: number;
  fixedCents: number;
  essentialCents: number;
  otherSpendingCents: number;
  bufferPercent: number;
  bufferCents: number;
  /** Money goals may use: income − fixed − must-haves − buffer. */
  freeToSaveCents: number;
}

export function buildMonthPlan(input: MonthPlanInput): MonthPlan {
  const bufferPercent = clampBufferPercent(input.bufferPercent);
  const bufferCents = Math.ceil((input.incomeCents * bufferPercent) / 100);
  const freeToSaveCents = Math.max(
    0,
    input.incomeCents - input.fixedCents - input.essentialCents - bufferCents
  );
  return { ...input, bufferPercent, bufferCents, freeToSaveCents };
}

export type MonthHealth =
  | { kind: "no-income" }
  | { kind: "over-budget"; overCents: number }
  | { kind: "into-buffer"; shortCents: number }
  | { kind: "ok"; leftCents: number };

/** Left for you = income − loans/bills − all spending − goal savings. Must stay ≥ buffer. */
export function monthHealth(plan: MonthPlan, goalSavingsCents: number): MonthHealth {
  if (plan.incomeCents <= 0) return { kind: "no-income" };
  const left =
    plan.incomeCents -
    plan.fixedCents -
    plan.essentialCents -
    plan.otherSpendingCents -
    goalSavingsCents;
  if (left < 0) return { kind: "over-budget", overCents: -left };
  if (left < plan.bufferCents) return { kind: "into-buffer", shortCents: plan.bufferCents - left };
  return { kind: "ok", leftCents: left };
}
