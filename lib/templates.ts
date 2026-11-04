/**
 * Smart-Start Templates: Pre-configured allocation structures.
 */

import type { CategorySchema } from "./schema-validator";
import { splitByPercentages } from "./math-engine";

export interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  categories: Omit<CategorySchema, "allocatedCents">[];
}

export const TEMPLATES: BudgetTemplate[] = [
  {
    id: "50-30-20",
    name: "The 50/30/20 Rule",
    description: "Needs 50%, Wants 30%, Savings 20%",
    categories: [
      { id: "needs", name: "Needs", percentage: 50, color: "#22c55e", essential: true },
      { id: "wants", name: "Wants", percentage: 30, color: "#3b82f6" },
      { id: "savings", name: "Savings", percentage: 20, color: "#8b5cf6" },
    ],
  },
  {
    id: "freelancer",
    name: "Freelancer Basic",
    description: "Tax, expenses, pay, savings",
    categories: [
      { id: "tax", name: "Tax (25%)", percentage: 25, color: "#ef4444", essential: true },
      { id: "expenses", name: "Business Expenses", percentage: 15, color: "#f59e0b", essential: true },
      { id: "pay", name: "Take-Home Pay", percentage: 45, color: "#22c55e" },
      { id: "savings", name: "Savings", percentage: 15, color: "#8b5cf6" },
    ],
  },
  {
    id: "student",
    name: "Student Living",
    description: "Essentials and minimal extras",
    categories: [
      { id: "housing", name: "Housing & Utilities", percentage: 40, color: "#06b6d4", essential: true },
      { id: "food", name: "Food & Groceries", percentage: 20, color: "#22c55e", essential: true },
      { id: "transport", name: "Transport", percentage: 10, color: "#f59e0b", essential: true },
      { id: "books", name: "Books & Supplies", percentage: 15, color: "#8b5cf6" },
      { id: "other", name: "Other / Fun", percentage: 15, color: "#ec4899" },
    ],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Start from scratch",
    categories: [],
  },
];

export function applyTemplateToTotal(
  template: BudgetTemplate,
  totalCents: number
): CategorySchema[] {
  const parts = splitByPercentages(
    totalCents,
    template.categories.map((c) => c.percentage ?? 0)
  );
  return template.categories.map((cat, i) => ({ ...cat, allocatedCents: parts[i] }));
}

/**
 * Re-split existing categories by their stored percentages (used when the total changes
 * and the user hasn't hand-edited the amounts yet).
 */
export function rescaleCategoriesToTotal(
  categories: CategorySchema[],
  totalCents: number
): CategorySchema[] {
  const parts = splitByPercentages(
    totalCents,
    categories.map((c) => c.percentage ?? 0)
  );
  return categories.map((c, i) => ({ ...c, allocatedCents: parts[i] }));
}

/** Must-haves keep their template share; goals come before the other categories. */
export function splitAfterGoals(
  categories: CategorySchema[],
  spendableCents: number,
  goalSavingsCents: number
): CategorySchema[] {
  const byShare = rescaleCategoriesToTotal(categories, spendableCents);
  const essentialSum = byShare
    .filter((c) => c.essential)
    .reduce((s, c) => s + c.allocatedCents, 0);
  const others = byShare.filter((c) => !c.essential);
  const otherPctSum = others.reduce((s, c) => s + (c.percentage ?? 0), 0);
  const pool = Math.max(0, spendableCents - essentialSum - goalSavingsCents);
  const otherParts =
    otherPctSum > 0
      ? splitByPercentages(
          pool,
          others.map((c) => ((c.percentage ?? 0) * 100) / otherPctSum)
        )
      : others.map(() => 0);
  let k = 0;
  return byShare.map((c) => (c.essential ? c : { ...c, allocatedCents: otherParts[k++] }));
}
