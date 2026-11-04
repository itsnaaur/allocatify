/**
 * Schema Validator: Ensures user-created templates don't have conflicting or invalid data.
 */

export interface CategorySchema {
  id: string;
  name: string;
  allocatedCents: number;
  color?: string;
  percentage?: number; // Optional target percentage (0-100)
  essential?: boolean; // Must-have spending (food, rent…) protected when suggesting savings
}

export interface IncomeSource {
  id: string;
  name: string;
  amountCents: number;
  /** Optional day of the month it's paid (1–31). */
  payDay?: number;
}

export interface BudgetSchema {
  id: string;
  name: string;
  monthKey?: string; // "YYYY-MM" e.g. "2025-03"
  totalCents: number;
  categories: CategorySchema[];
  currency?: string;
  activeTemplateId?: string; // e.g. "50-30-20", "freelancer"
  autoScale?: boolean; // Categories follow their percentages when the total changes
  incomeSources?: IncomeSource[]; // Salary, freelance… (totalCents is their sum)
  carryInCents?: number; // Leftover brought in from the previous month
  carryInFrom?: string; // monthKey it came from
  carryOutCents?: number; // Leftover moved out to the next month
  carryOutHandled?: boolean; // Month-end leftover was dealt with (moved or kept)
  createdAt: number;
  updatedAt: number;
}

export type SchemaValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validate a category schema.
 */
export function validateCategory(cat: unknown): SchemaValidationResult {
  if (!cat || typeof cat !== "object") {
    return { valid: false, error: "Category must be an object" };
  }

  const c = cat as Record<string, unknown>;

  if (!c.id || typeof c.id !== "string") {
    return { valid: false, error: "Category must have a string id" };
  }

  if (!c.name || typeof c.name !== "string") {
    return { valid: false, error: "Category must have a string name" };
  }

  const allocated =
    typeof c.allocatedCents === "number"
      ? c.allocatedCents
      : typeof c.allocatedCents === "string"
        ? parseInt(c.allocatedCents, 10)
        : NaN;
  if (isNaN(allocated) || allocated < 0) {
    return { valid: false, error: "allocatedCents must be a non-negative number" };
  }

  if (c.percentage !== undefined) {
    const pct =
      typeof c.percentage === "number"
        ? c.percentage
        : typeof c.percentage === "string"
          ? parseFloat(c.percentage)
          : NaN;
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return { valid: false, error: "percentage must be between 0 and 100" };
    }
  }

  return { valid: true };
}

/**
 * Validate a full budget schema.
 */
export function validateBudgetSchema(schema: unknown): SchemaValidationResult {
  if (!schema || typeof schema !== "object") {
    return { valid: false, error: "Schema must be an object" };
  }

  const s = schema as Record<string, unknown>;

  if (!s.categories || !Array.isArray(s.categories)) {
    return { valid: false, error: "Schema must have a categories array" };
  }

  const ids = new Set<string>();
  for (let i = 0; i < s.categories.length; i++) {
    const result = validateCategory(s.categories[i]);
    if (!result.valid) {
      return { valid: false, error: `Category ${i}: ${result.error}` };
    }
    const cat = s.categories[i] as CategorySchema;
    if (ids.has(cat.id)) {
      return { valid: false, error: `Duplicate category id: ${cat.id}` };
    }
    ids.add(cat.id);
  }

  const total =
    typeof s.totalCents === "number"
      ? s.totalCents
      : typeof s.totalCents === "string"
        ? parseInt(s.totalCents, 10)
        : NaN;
  if (isNaN(total) || total < 0) {
    return { valid: false, error: "totalCents must be a non-negative number" };
  }

  return { valid: true };
}
