/**
 * Smart-Start Templates: Pre-configured allocation structures.
 */

import type { CategorySchema } from "./schema-validator";

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
      { id: "needs", name: "Needs", percentage: 50, color: "#22c55e" },
      { id: "wants", name: "Wants", percentage: 30, color: "#3b82f6" },
      { id: "savings", name: "Savings", percentage: 20, color: "#8b5cf6" },
    ],
  },
  {
    id: "freelancer",
    name: "Freelancer Basic",
    description: "Tax, expenses, pay, savings",
    categories: [
      { id: "tax", name: "Tax (25%)", percentage: 25, color: "#ef4444" },
      { id: "expenses", name: "Business Expenses", percentage: 15, color: "#f59e0b" },
      { id: "pay", name: "Take-Home Pay", percentage: 45, color: "#22c55e" },
      { id: "savings", name: "Savings", percentage: 15, color: "#8b5cf6" },
    ],
  },
  {
    id: "student",
    name: "Student Living",
    description: "Essentials and minimal extras",
    categories: [
      { id: "housing", name: "Housing & Utilities", percentage: 40, color: "#06b6d4" },
      { id: "food", name: "Food & Groceries", percentage: 20, color: "#22c55e" },
      { id: "transport", name: "Transport", percentage: 10, color: "#f59e0b" },
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
  return template.categories.map((cat) => {
    const pct = (cat.percentage ?? 0) / 100;
    return {
      ...cat,
      allocatedCents: Math.round(totalCents * pct),
    };
  });
}
