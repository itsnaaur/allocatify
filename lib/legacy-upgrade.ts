/**
 * Budgets saved before must-haves and auto-split existed. When such a budget still
 * matches its template (same categories, amounts untouched), it gets the template's
 * must-have flags and keeps following the template, so the safety buffer is respected.
 * Budgets the user edited by hand keep their amounts.
 */

import type { CategorySchema } from "./schema-validator";
import { applyTemplateToTotal, TEMPLATES, type BudgetTemplate } from "./templates";

export interface LegacyBudgetLike {
  totalCents: number;
  categories: CategorySchema[];
  activeTemplateId?: string | null;
  autoScale?: boolean;
}

/** Same categories as the template, in order (by id, or by name for copied months). */
function matchesTemplate(categories: CategorySchema[], template: BudgetTemplate): boolean {
  return (
    template.categories.length > 0 &&
    template.categories.length === categories.length &&
    template.categories.every(
      (t, i) =>
        categories[i]?.id === t.id ||
        categories[i]?.name.trim().toLowerCase() === t.name.toLowerCase()
    )
  );
}

export function upgradeLegacyBudget(budget: LegacyBudgetLike): {
  categories: CategorySchema[];
  autoScale: boolean;
} {
  const template = TEMPLATES.find((t) => t.id === budget.activeTemplateId);
  const matches = !!template && matchesTemplate(budget.categories, template);

  // Fill in what older saves never had: must-have flags and template percentages.
  const categories = matches
    ? budget.categories.map((c, i) => ({
        ...c,
        percentage: c.percentage ?? template!.categories[i].percentage,
        essential: c.essential ?? template!.categories[i].essential,
      }))
    : budget.categories;

  if (budget.autoScale !== undefined) return { categories, autoScale: budget.autoScale };
  if (!matches) return { categories, autoScale: false };

  // Untouched = nothing allocated yet, or exactly the template's split of the total.
  const templateSplit = applyTemplateToTotal(template!, budget.totalCents);
  const untouched =
    categories.every((c) => c.allocatedCents === 0) ||
    categories.every((c, i) => Math.abs(c.allocatedCents - templateSplit[i].allocatedCents) <= 1);
  return { categories, autoScale: untouched };
}
