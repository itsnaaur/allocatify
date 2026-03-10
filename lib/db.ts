/**
 * Dexie.js wrapper for IndexedDB persistence.
 * Handles the "Stateless-First" data sovereignty — data lives only on the user's device.
 */

import Dexie, { type Table } from "dexie";
import type { BudgetSchema } from "./schema-validator";

export interface StoredBudget extends BudgetSchema {
  id: string;
  monthKey?: string;
  updatedAt: number;
}

export class AllocatifyDB extends Dexie {
  budgets!: Table<StoredBudget, string>;

  constructor() {
    super("AllocatifyDB");
    this.version(1).stores({
      budgets: "id, updatedAt",
    });
    this.version(2).stores({
      budgets: "id, monthKey, updatedAt",
    });
  }
}

// Singleton — only create when on client
let db: AllocatifyDB | null = null;

export function getDB(): AllocatifyDB | null {
  if (typeof window === "undefined") return null;
  if (!db) db = new AllocatifyDB();
  return db;
}

export async function loadAllBudgets(): Promise<StoredBudget[]> {
  const database = getDB();
  if (!database) return [];
  const all = await database.budgets.toArray();
  return all.sort((a, b) => {
    const aKey = a.monthKey ?? a.id;
    const bKey = b.monthKey ?? b.id;
    return bKey.localeCompare(aKey);
  });
}

export async function loadBudget(id?: string): Promise<StoredBudget | null> {
  const database = getDB();
  if (!database) return null;
  if (id) {
    return (await database.budgets.get(id)) ?? null;
  }
  const all = await loadAllBudgets();
  return all[0] ?? null;
}

export async function saveBudget(budget: StoredBudget): Promise<void> {
  const database = getDB();
  if (!database) return;
  await database.budgets.put({
    ...budget,
    updatedAt: Date.now(),
  });
}

export async function deleteBudget(id: string): Promise<void> {
  const database = getDB();
  if (!database) return;
  await database.budgets.delete(id);
}

export async function resetAllData(): Promise<void> {
  const database = getDB();
  if (!database) return;
  await database.budgets.clear();
}
