/**
 * Loans, bills, savings goals and the safety buffer. These live across months
 * (unlike categories, which belong to one month).
 */

import { create } from "zustand";
import { getDB, getSetting, setSetting } from "@/lib/db";
import {
  clampBufferPercent,
  DEFAULT_BUFFER_PERCENT,
  type Contribution,
  type Expense,
  type Goal,
  type Obligation,
  type Payment,
} from "@/lib/finance";

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export type ObligationInput = Omit<Obligation, "id" | "createdAt">;
export type GoalInput = Omit<Goal, "id" | "createdAt">;
export type ExpenseInput = Omit<Expense, "id" | "createdAt">;

export interface PlannerState {
  obligations: Obligation[];
  payments: Payment[];
  goals: Goal[];
  contributions: Contribution[];
  expenses: Expense[];
  bufferPercent: number;
  isLoaded: boolean;

  load: () => Promise<void>;
  setBufferPercent: (pct: number) => Promise<void>;

  addObligation: (input: ObligationInput) => Promise<void>;
  updateObligation: (id: string, input: ObligationInput) => Promise<void>;
  deleteObligation: (id: string) => Promise<void>;
  markPaid: (obligationId: string, monthKey: string, amountCents: number) => Promise<void>;
  unmarkPaid: (obligationId: string, monthKey: string) => Promise<void>;

  addGoal: (input: GoalInput) => Promise<void>;
  updateGoal: (id: string, input: GoalInput) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  recordSaving: (goalId: string, monthKey: string, amountCents: number) => Promise<void>;
  removeSaving: (goalId: string, monthKey: string) => Promise<void>;
  /** Saving that came from last month's leftover (kept apart from the monthly saving). */
  recordCarrySaving: (goalId: string, monthKey: string, amountCents: number) => Promise<void>;
  removeCarrySaving: (goalId: string, monthKey: string) => Promise<void>;

  addExpense: (input: ExpenseInput) => Promise<void>;
  /** Many at once (bank import), saved in one transaction. */
  addExpenses: (inputs: ExpenseInput[]) => Promise<void>;
  updateExpense: (id: string, input: ExpenseInput) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

const byCreated = <T extends { createdAt: number }>(a: T, b: T) => a.createdAt - b.createdAt;

export const usePlannerStore = create<PlannerState>((set, get) => ({
  obligations: [],
  payments: [],
  goals: [],
  contributions: [],
  expenses: [],
  bufferPercent: DEFAULT_BUFFER_PERCENT,
  isLoaded: false,

  load: async () => {
    const db = getDB();
    if (!db) return;
    const [obligations, payments, goals, contributions, expenses, buffer] = await Promise.all([
      db.obligations.toArray(),
      db.payments.toArray(),
      db.goals.toArray(),
      db.contributions.toArray(),
      db.expenses.toArray(),
      getSetting<number>("bufferPercent"),
    ]);
    set({
      obligations: obligations.sort(byCreated),
      payments,
      goals: goals.sort(byCreated),
      contributions,
      expenses: expenses.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
      bufferPercent: clampBufferPercent(buffer ?? DEFAULT_BUFFER_PERCENT),
      isLoaded: true,
    });
  },

  setBufferPercent: async (pct) => {
    const value = clampBufferPercent(pct);
    set({ bufferPercent: value });
    await setSetting("bufferPercent", value);
  },

  addObligation: async (input) => {
    const ob: Obligation = { ...input, id: newId("ob"), createdAt: Date.now() };
    set({ obligations: [...get().obligations, ob] });
    await getDB()?.obligations.put(ob);
  },

  updateObligation: async (id, input) => {
    const existing = get().obligations.find((o) => o.id === id);
    if (!existing) return;
    const ob: Obligation = { ...existing, ...input };
    set({ obligations: get().obligations.map((o) => (o.id === id ? ob : o)) });
    await getDB()?.obligations.put(ob);
  },

  deleteObligation: async (id) => {
    set({
      obligations: get().obligations.filter((o) => o.id !== id),
      payments: get().payments.filter((p) => p.obligationId !== id),
    });
    const db = getDB();
    if (!db) return;
    await db.transaction("rw", db.obligations, db.payments, async () => {
      await db.obligations.delete(id);
      await db.payments.where("obligationId").equals(id).delete();
    });
  },

  markPaid: async (obligationId, monthKey, amountCents) => {
    const payment: Payment = {
      id: `${obligationId}_${monthKey}`,
      obligationId,
      monthKey,
      amountCents,
      paidAt: Date.now(),
    };
    set({ payments: [...get().payments.filter((p) => p.id !== payment.id), payment] });
    await getDB()?.payments.put(payment);
  },

  unmarkPaid: async (obligationId, monthKey) => {
    const id = `${obligationId}_${monthKey}`;
    set({ payments: get().payments.filter((p) => p.id !== id) });
    await getDB()?.payments.delete(id);
  },

  addGoal: async (input) => {
    const goal: Goal = { ...input, id: newId("goal"), createdAt: Date.now() };
    set({ goals: [...get().goals, goal] });
    await getDB()?.goals.put(goal);
  },

  updateGoal: async (id, input) => {
    const existing = get().goals.find((g) => g.id === id);
    if (!existing) return;
    const goal: Goal = { ...existing, ...input };
    set({ goals: get().goals.map((g) => (g.id === id ? goal : g)) });
    await getDB()?.goals.put(goal);
  },

  deleteGoal: async (id) => {
    set({
      goals: get().goals.filter((g) => g.id !== id),
      contributions: get().contributions.filter((c) => c.goalId !== id),
    });
    const db = getDB();
    if (!db) return;
    await db.transaction("rw", db.goals, db.contributions, async () => {
      await db.goals.delete(id);
      await db.contributions.where("goalId").equals(id).delete();
    });
  },

  recordSaving: async (goalId, monthKey, amountCents) => {
    const entry: Contribution = {
      id: `${goalId}_${monthKey}`,
      goalId,
      monthKey,
      amountCents,
      savedAt: Date.now(),
    };
    set({ contributions: [...get().contributions.filter((c) => c.id !== entry.id), entry] });
    await getDB()?.contributions.put(entry);
  },

  removeSaving: async (goalId, monthKey) => {
    const id = `${goalId}_${monthKey}`;
    set({ contributions: get().contributions.filter((c) => c.id !== id) });
    await getDB()?.contributions.delete(id);
  },

  recordCarrySaving: async (goalId, monthKey, amountCents) => {
    const entry: Contribution = {
      id: `${goalId}_${monthKey}_carry`,
      goalId,
      monthKey,
      amountCents,
      savedAt: Date.now(),
    };
    set({ contributions: [...get().contributions.filter((c) => c.id !== entry.id), entry] });
    await getDB()?.contributions.put(entry);
  },

  removeCarrySaving: async (goalId, monthKey) => {
    const id = `${goalId}_${monthKey}_carry`;
    set({ contributions: get().contributions.filter((c) => c.id !== id) });
    await getDB()?.contributions.delete(id);
  },

  addExpense: async (input) => {
    const expense: Expense = { ...input, id: newId("exp"), createdAt: Date.now() };
    set({
      expenses: [expense, ...get().expenses].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
      ),
    });
    await getDB()?.expenses.put(expense);
  },

  addExpenses: async (inputs) => {
    const now = Date.now();
    const created: Expense[] = inputs.map((input, i) => ({
      ...input,
      id: newId("exp"),
      createdAt: now + i,
    }));
    set({
      expenses: [...created, ...get().expenses].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
      ),
    });
    await getDB()?.expenses.bulkPut(created);
  },

  updateExpense: async (id, input) => {
    const existing = get().expenses.find((e) => e.id === id);
    if (!existing) return;
    const expense: Expense = { ...existing, ...input };
    set({
      expenses: get()
        .expenses.map((e) => (e.id === id ? expense : e))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    });
    await getDB()?.expenses.put(expense);
  },

  deleteExpense: async (id) => {
    set({ expenses: get().expenses.filter((e) => e.id !== id) });
    await getDB()?.expenses.delete(id);
  },
}));
