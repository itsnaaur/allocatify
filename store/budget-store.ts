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
  getSetting,
  switchCurrencyEverywhere,
  type StoredBudget,
} from "@/lib/db";
import {
  applyTemplateToTotal,
  splitAfterGoals,
  TEMPLATES,
  type BudgetTemplate,
} from "@/lib/templates";
import type { CurrencyCode } from "@/lib/currencies";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";
import { getMonthKey, formatMonthKey } from "@/lib/month-utils";
import { upgradeLegacyBudget } from "@/lib/legacy-upgrade";
import { usePlannerStore } from "@/store/planner-store";

export interface BudgetState {
  totalCents: number;
  categories: CategorySchema[];
  budgetId: string;
  budgetName: string;
  monthKey: string | null;
  monthlyBudgets: StoredBudget[];
  currency: CurrencyCode;
  activeTemplateId: string | null;
  /** Categories follow their percentages when the total changes (until hand-edited). */
  autoScale: boolean;
  createdAt: number;
  /** Leftover brought in from the previous month (this month's extra money). */
  carryInCents: number;
  carryInFrom: string | null;
  /** Leftover moved out of this month to the next one. */
  carryOutCents: number;
  carryOutHandled: boolean;
  isHydrated: boolean;
  // Actions
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  setTotal: (cents: number) => void;
  setCategoryAllocation: (id: string, cents: number) => void;
  /**
   * While auto-split is on: must-haves get their share of what's left to spend,
   * goals come next, and the other categories share whatever remains.
   */
  autoSplit: (spendableCents: number, goalSavingsCents: number) => void;
  /** Returns false when the name is empty or already used. */
  addCategory: (name: string, color?: string) => boolean;
  removeCategory: (id: string) => void;
  /** Returns false when the name is empty or already used by another category. */
  renameCategory: (id: string, name: string) => boolean;
  toggleEssential: (id: string) => void;
  reorderCategories: (fromIndex: number, toIndex: number) => void;
  applyTemplate: (template: BudgetTemplate) => void;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
  reset: () => void;
  switchToMonth: (monthKey: string) => Promise<void>;
  createNewMonth: (monthKey: string, copyFromCurrent?: boolean) => Promise<void>;
  deleteMonth: (monthKey: string) => Promise<void>;
  /** Move leftover from a finished month into the month on screen. */
  carryOverToCurrent: (fromMonthKey: string, amountCents: number) => Promise<void>;
  /** Mark a finished month's leftover as dealt with (kept, or moved to a goal). */
  markLeftoverHandled: (monthKey: string) => Promise<void>;
  /** Undo the carry-in shown on the current month. */
  undoCarryIn: () => Promise<void>;
  /** Offer a finished month's leftover again (after undoing a move into a goal). */
  reopenLeftover: (monthKey: string) => Promise<void>;
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

const DEFAULT_TEMPLATE_ID = "50-30-20";
const DEFAULT_CATEGORIES: CategorySchema[] = applyTemplateToTotal(
  TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!,
  0
);

function nameTaken(categories: CategorySchema[], name: string, exceptId?: string): boolean {
  const n = name.trim().toLowerCase();
  return categories.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === n);
}

function applyBudgetToState(set: (s: Partial<BudgetState>) => void, budget: StoredBudget) {
  const { categories, autoScale } = upgradeLegacyBudget(budget);
  set({
    budgetId: budget.id,
    budgetName: budget.name,
    monthKey: budget.monthKey ?? budget.id,
    totalCents: budget.totalCents,
    categories,
    activeTemplateId: budget.activeTemplateId ?? null,
    autoScale,
    createdAt: budget.createdAt ?? Date.now(),
    carryInCents: budget.carryInCents ?? 0,
    carryInFrom: budget.carryInFrom ?? null,
    carryOutCents: budget.carryOutCents ?? 0,
    carryOutHandled: budget.carryOutHandled ?? false,
  });
}

/** Change a month that isn't on screen, straight in storage. */
async function updateStoredBudget(
  monthKey: string,
  change: (b: StoredBudget) => StoredBudget
): Promise<void> {
  const budget = await loadBudget(monthKey);
  if (budget) await saveBudget(change(budget));
}

/** Saves run one after another so an older save can never overwrite a newer one. */
let saveQueue: Promise<void> = Promise.resolve();

export const useBudgetStore = create<BudgetState>((set, get) => ({
  totalCents: 0,
  categories: DEFAULT_CATEGORIES,
  budgetId: "default",
  budgetName: "My Budget",
  monthKey: null,
  monthlyBudgets: [],
  currency: DEFAULT_CURRENCY,
  activeTemplateId: null,
  autoScale: false,
  createdAt: Date.now(),
  carryInCents: 0,
  carryInFrom: null,
  carryOutCents: 0,
  carryOutHandled: false,
  isHydrated: false,

  setCurrency: async (currency) => {
    const from = get().currency;
    if (from === currency) return;
    // Finish pending saves, then re-express every stored amount in the new currency
    // (e.g. $5,000.00 → ¥5,000, not ¥500,000).
    await saveQueue;
    await switchCurrencyEverywhere(from, currency);
    const current = await loadBudget(get().budgetId);
    set({ currency, monthlyBudgets: await loadAllBudgets() });
    if (current) applyBudgetToState(set, current);
    await usePlannerStore.getState().load();
  },

  setTotal: (cents) => {
    set({ totalCents: Math.max(0, cents) });
    get().persist();
  },

  autoSplit: (spendableCents, goalSavingsCents) => {
    const { autoScale, categories } = get();
    if (!autoScale || categories.length === 0) return;
    const next = splitAfterGoals(categories, Math.max(0, spendableCents), goalSavingsCents);
    if (next.every((c, i) => c.allocatedCents === categories[i].allocatedCents)) return;
    set({ categories: next });
    get().persist();
  },

  setCategoryAllocation: (id, cents) => {
    set((state) => ({
      autoScale: false,
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, allocatedCents: Math.max(0, cents) } : c
      ),
    }));
    get().persist();
  },

  addCategory: (name, color) => {
    const state = get();
    const trimmed = name.trim();
    if (!trimmed || nameTaken(state.categories, trimmed)) return false;
    const usedColors = new Set(state.categories.map((c) => c.color));
    const pick = color ?? COLORS.find((c) => !usedColors.has(c)) ?? COLORS[0];
    set({
      autoScale: false,
      categories: [
        ...state.categories,
        {
          id: generateId(),
          name: trimmed,
          allocatedCents: 0,
          color: pick,
        },
      ],
    });
    get().persist();
    return true;
  },

  removeCategory: (id) => {
    set((state) => ({
      autoScale: false,
      categories: state.categories.filter((c) => c.id !== id),
    }));
    get().persist();
  },

  renameCategory: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed || nameTaken(get().categories, trimmed, id)) return false;
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, name: trimmed } : c
      ),
    }));
    get().persist();
    return true;
  },

  toggleEssential: (id) => {
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, essential: !c.essential } : c
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
      set({ categories: [], activeTemplateId: template.id, autoScale: false });
    } else {
      const cats = applyTemplateToTotal(template, totalCents);
      set({ categories: cats, activeTemplateId: template.id, autoScale: true });
    }
    get().persist();
  },

  hydrate: async () => {
    const [all, savedCurrency] = await Promise.all([
      loadAllBudgets(),
      getSetting<string>("currency"),
    ]);
    const currency =
      savedCurrency && savedCurrency in CURRENCIES
        ? (savedCurrency as CurrencyCode)
        : DEFAULT_CURRENCY;
    set({ monthlyBudgets: all, currency });
    await usePlannerStore.getState().load();

    const thisMonth = getMonthKey(new Date());
    if (all.length > 0) {
      // Open this month if it exists, else the latest month before it, else the earliest.
      const key = (b: StoredBudget) => b.monthKey ?? b.id;
      const pick =
        all.find((b) => key(b) === thisMonth) ??
        all.find((b) => key(b) < thisMonth) ??
        all[all.length - 1];
      applyBudgetToState(set, pick);
    } else {
      // No saved budgets - init with current month and persist so it appears in the list
      const initial: StoredBudget = {
        id: thisMonth,
        name: formatMonthKey(thisMonth),
        monthKey: thisMonth,
        totalCents: 0,
        categories: DEFAULT_CATEGORIES,
        currency,
        activeTemplateId: DEFAULT_TEMPLATE_ID,
        autoScale: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveBudget(initial);
      applyBudgetToState(set, initial);
      set({ monthlyBudgets: [initial] });
    }
    set({ isHydrated: true });
  },

  persist: () => {
    const state = get();
    const payload: StoredBudget = {
      id: state.budgetId,
      name: state.budgetName,
      monthKey: state.monthKey ?? state.budgetId,
      totalCents: state.totalCents,
      categories: state.categories,
      currency: state.currency,
      activeTemplateId: state.activeTemplateId ?? undefined,
      autoScale: state.autoScale,
      createdAt: state.createdAt,
      carryInCents: state.carryInCents || undefined,
      carryInFrom: state.carryInFrom ?? undefined,
      carryOutCents: state.carryOutCents || undefined,
      carryOutHandled: state.carryOutHandled || undefined,
      updatedAt: Date.now(),
    };
    saveQueue = saveQueue
      .then(async () => {
        await saveBudget(payload);
        set({ monthlyBudgets: await loadAllBudgets() });
      })
      .catch((err) => console.error("[Allocatify] Could not save budget", err));
    return saveQueue;
  },

  reset: () => {
    const state = get();
    set({
      totalCents: 0,
      categories: DEFAULT_CATEGORIES,
      budgetId: state.budgetId,
      budgetName: state.budgetName,
      monthKey: state.monthKey,
      activeTemplateId: DEFAULT_TEMPLATE_ID,
      autoScale: true,
    });
    get().persist();
  },

  switchToMonth: async (monthKey) => {
    await saveQueue;
    const budget = await loadBudget(monthKey);
    if (budget) {
      applyBudgetToState(set, budget);
    }
  },

  createNewMonth: async (monthKey, copyFromCurrent = true) => {
    await saveQueue;
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
      activeTemplateId: copyFromCurrent ? state.activeTemplateId ?? undefined : DEFAULT_TEMPLATE_ID,
      autoScale: copyFromCurrent ? state.autoScale : true,
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
        activeTemplateId: DEFAULT_TEMPLATE_ID,
        autoScale: true,
        createdAt: Date.now(),
      });
      get().persist();
    }
  },

  carryOverToCurrent: async (fromMonthKey, amountCents) => {
    if (amountCents <= 0) return;
    const state = get();
    if (fromMonthKey === state.monthKey) return;
    set({
      carryInCents: state.carryInCents + amountCents,
      carryInFrom: fromMonthKey,
    });
    await get().persist();
    await updateStoredBudget(fromMonthKey, (b) => ({
      ...b,
      carryOutCents: (b.carryOutCents ?? 0) + amountCents,
      carryOutHandled: true,
    }));
    set({ monthlyBudgets: await loadAllBudgets() });
  },

  markLeftoverHandled: async (monthKey) => {
    if (monthKey === get().monthKey) {
      set({ carryOutHandled: true });
      await get().persist();
      return;
    }
    await saveQueue;
    await updateStoredBudget(monthKey, (b) => ({ ...b, carryOutHandled: true }));
    set({ monthlyBudgets: await loadAllBudgets() });
  },

  reopenLeftover: async (monthKey) => {
    if (monthKey === get().monthKey) {
      set({ carryOutHandled: false });
      await get().persist();
      return;
    }
    await saveQueue;
    await updateStoredBudget(monthKey, (b) => ({ ...b, carryOutHandled: undefined }));
    set({ monthlyBudgets: await loadAllBudgets() });
  },

  undoCarryIn: async () => {
    const { carryInCents, carryInFrom } = get();
    if (!carryInFrom || carryInCents <= 0) return;
    set({ carryInCents: 0, carryInFrom: null });
    await get().persist();
    await updateStoredBudget(carryInFrom, (b) => ({
      ...b,
      carryOutCents: Math.max(0, (b.carryOutCents ?? 0) - carryInCents) || undefined,
      carryOutHandled: undefined,
    }));
    set({ monthlyBudgets: await loadAllBudgets() });
  },
}));
