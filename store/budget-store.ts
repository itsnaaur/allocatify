/**
 * Global state for budget allocation. Reactive updates with zero latency.
 */

import { create } from "zustand";
import type { CategorySchema } from "@/lib/schema-validator";
import {
  loadAllBudgets,
  loadBudget,
  saveBudget,
  deleteBudget,
  type StoredBudget,
} from "@/lib/db";
import { applyTemplateToTotal, type BudgetTemplate } from "@/lib/templates";
import type { CurrencyCode } from "@/lib/currencies";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { getMonthKey, getNextMonthKey, formatMonthKey } from "@/lib/month-utils";

export interface BudgetState {
  totalCents: number;
  categories: CategorySchema[];
  budgetId: string;
  budgetName: string;
  monthKey: string | null;
  monthlyBudgets: StoredBudget[];
  currency: CurrencyCode;
  activeTemplateId: string | null;
  isHydrated: boolean;
  // Actions
  setCurrency: (currency: CurrencyCode) => void;
  setTotal: (cents: number) => void;
  setCategoryAllocation: (id: string, cents: number) => void;
  addCategory: (name: string, color?: string) => void;
  removeCategory: (id: string) => void;
  renameCategory: (id: string, name: string) => void;
  reorderCategories: (fromIndex: number, toIndex: number) => void;
  applyTemplate: (template: BudgetTemplate) => void;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
  reset: () => void;
  switchToMonth: (monthKey: string) => Promise<void>;
  createNewMonth: (monthKey: string, copyFromCurrent?: boolean) => Promise<void>;
  deleteMonth: (monthKey: string) => Promise<void>;
}

function generateId(): string {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const COLORS = [
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
];

const DEFAULT_CATEGORIES: CategorySchema[] = [
  { id: "needs", name: "Needs", allocatedCents: 0, color: "#22c55e" },
  { id: "wants", name: "Wants", allocatedCents: 0, color: "#3b82f6" },
  { id: "savings", name: "Savings", allocatedCents: 0, color: "#8b5cf6" },
];

function applyBudgetToState(set: (s: Partial<BudgetState>) => void, budget: StoredBudget) {
  set({
    budgetId: budget.id,
    budgetName: budget.name,
    monthKey: budget.monthKey ?? budget.id,
    totalCents: budget.totalCents,
    categories: budget.categories,
    currency: (budget.currency as CurrencyCode) ?? DEFAULT_CURRENCY,
    activeTemplateId: budget.activeTemplateId ?? null,
  });
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  totalCents: 0,
  categories: DEFAULT_CATEGORIES,
  budgetId: "default",
  budgetName: "My Budget",
  monthKey: null,
  monthlyBudgets: [],
  currency: DEFAULT_CURRENCY,
  activeTemplateId: null,
  isHydrated: false,

  setCurrency: (currency) => {
    set({ currency });
    get().persist();
  },

  setTotal: (cents) => {
    set({ totalCents: Math.max(0, cents) });
    get().persist();
  },

  setCategoryAllocation: (id, cents) => {
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, allocatedCents: Math.max(0, cents) } : c
      ),
    }));
    get().persist();
  },

  addCategory: (name, color) => {
    const state = get();
    const usedColors = new Set(state.categories.map((c) => c.color));
    const pick = color ?? COLORS.find((c) => !usedColors.has(c)) ?? COLORS[0];
    set({
      categories: [
        ...state.categories,
        {
          id: generateId(),
          name,
          allocatedCents: 0,
          color: pick,
        },
      ],
    });
    get().persist();
  },

  removeCategory: (id) => {
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }));
    get().persist();
  },

  renameCategory: (id, name) => {
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, name } : c
      ),
    }));
    get().persist();
  },

  reorderCategories: (fromIndex, toIndex) => {
    set((state) => {
      const cats = [...state.categories];
      const [removed] = cats.splice(fromIndex, 1);
      cats.splice(toIndex, 0, removed);
      return { categories: cats };
    });
    get().persist();
  },

  applyTemplate: (template) => {
    const { totalCents } = get();
    if (template.categories.length === 0) {
      set({ categories: [], activeTemplateId: template.id });
    } else {
      const cats = applyTemplateToTotal(template, totalCents);
      set({ categories: cats, activeTemplateId: template.id });
    }
    get().persist();
  },

  hydrate: async () => {
    const all = await loadAllBudgets();
    set({ monthlyBudgets: all });

    if (all.length > 0) {
      const latest = all[0];
      applyBudgetToState(set, latest);
    } else {
      // No saved budgets - init with current month and persist so it appears in the list
      const monthKey = getMonthKey(new Date());
      const initial: StoredBudget = {
        id: monthKey,
        name: formatMonthKey(monthKey),
        monthKey,
        totalCents: 0,
        categories: DEFAULT_CATEGORIES,
        currency: DEFAULT_CURRENCY,
        activeTemplateId: "50-30-20",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveBudget(initial);
      applyBudgetToState(set, initial);
      set({ monthlyBudgets: [initial] });
    }
    set({ isHydrated: true });
  },

  persist: async () => {
    const state = get();
    const payload: StoredBudget = {
      id: state.budgetId,
      name: state.budgetName,
      monthKey: state.monthKey ?? state.budgetId,
      totalCents: state.totalCents,
      categories: state.categories,
      currency: state.currency,
      activeTemplateId: state.activeTemplateId ?? undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveBudget(payload);
    const all = await loadAllBudgets();
    set({ monthlyBudgets: all });
  },

  reset: () => {
    const state = get();
    set({
      totalCents: 0,
      categories: DEFAULT_CATEGORIES,
      budgetId: state.budgetId,
      budgetName: state.budgetName,
      monthKey: state.monthKey,
      activeTemplateId: "50-30-20",
    });
    get().persist();
  },

  switchToMonth: async (monthKey) => {
    const budget = await loadBudget(monthKey);
    if (budget) {
      applyBudgetToState(set, budget);
    }
  },

  createNewMonth: async (monthKey, copyFromCurrent = true) => {
    const state = get();
    const existing = await loadBudget(monthKey);
    if (existing) {
      applyBudgetToState(set, existing);
      return;
    }

    const name = formatMonthKey(monthKey);
    const newBudget: StoredBudget = {
      id: monthKey,
      name,
      monthKey,
      totalCents: copyFromCurrent ? state.totalCents : 0,
      categories: copyFromCurrent
        ? state.categories.map((c) => ({ ...c, id: generateId(), allocatedCents: c.allocatedCents }))
        : DEFAULT_CATEGORIES,
      currency: state.currency,
      activeTemplateId: copyFromCurrent ? state.activeTemplateId ?? undefined : "50-30-20",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveBudget(newBudget);
    applyBudgetToState(set, newBudget);
    const all = await loadAllBudgets();
    set({ monthlyBudgets: all });
  },

  deleteMonth: async (monthKey) => {
    await deleteBudget(monthKey);
    const all = await loadAllBudgets();
    set({ monthlyBudgets: all });
    if (get().monthKey === monthKey && all.length > 0) {
      applyBudgetToState(set, all[0]);
    } else if (all.length === 0) {
      const newMonthKey = getMonthKey(new Date());
      set({
        budgetId: newMonthKey,
        budgetName: formatMonthKey(newMonthKey),
        monthKey: newMonthKey,
        totalCents: 0,
        categories: DEFAULT_CATEGORIES,
        activeTemplateId: "50-30-20",
      });
    }
  },
}));
