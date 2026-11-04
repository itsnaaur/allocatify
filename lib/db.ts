/**
 * Dexie.js wrapper for IndexedDB persistence.
 * Handles the "Stateless-First" data sovereignty — data lives only on the user's device.
 */

import Dexie, { type Table } from "dexie";
import type { BudgetSchema } from "./schema-validator";
import type { Contribution, Expense, Goal, Obligation, Payment } from "./finance";
import { CURRENCIES, DEFAULT_CURRENCY, type CurrencyCode } from "./currencies";
import { rescaleMinor } from "./math-engine";
import type { BackupData } from "./backup";

export interface StoredBudget extends BudgetSchema {
  id: string;
  monthKey?: string;
  updatedAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export class AllocatifyDB extends Dexie {
  budgets!: Table<StoredBudget, string>;
  obligations!: Table<Obligation, string>;
  payments!: Table<Payment, string>;
  goals!: Table<Goal, string>;
  contributions!: Table<Contribution, string>;
  expenses!: Table<Expense, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super("AllocatifyDB");
    this.version(1).stores({
      budgets: "id, updatedAt",
    });
    this.version(2).stores({
      budgets: "id, monthKey, updatedAt",
    });
    this.version(3)
      .stores({
        budgets: "id, monthKey, updatedAt",
        obligations: "id, kind",
        payments: "id, obligationId, monthKey",
        goals: "id",
        contributions: "id, goalId, monthKey",
        settings: "key",
      })
      .upgrade(async (tx) => {
        // Currency becomes one app-wide setting. Use the most recent month's currency and
        // re-express any month saved in a currency with different minor units.
        const budgets = (await tx.table("budgets").toArray()) as StoredBudget[];
        budgets.sort((a, b) => (b.monthKey ?? b.id).localeCompare(a.monthKey ?? a.id));
        const currency = toCurrency(budgets[0]?.currency);
        const toMinor = CURRENCIES[currency].minorUnitsPerMajor;
        for (const b of budgets) {
          const fromMinor = CURRENCIES[toCurrency(b.currency)].minorUnitsPerMajor;
          await tx.table("budgets").put(rescaleBudget(b, fromMinor, toMinor, currency));
        }
        await tx.table("settings").put({ key: "currency", value: currency });
      });
    this.version(4).stores({
      budgets: "id, monthKey, updatedAt",
      obligations: "id, kind",
      payments: "id, obligationId, monthKey",
      goals: "id",
      contributions: "id, goalId, monthKey",
      expenses: "id, monthKey, categoryId",
      settings: "key",
    });
  }
}

function toCurrency(value: unknown): CurrencyCode {
  return typeof value === "string" && value in CURRENCIES
    ? (value as CurrencyCode)
    : DEFAULT_CURRENCY;
}

function rescaleBudget(
  b: StoredBudget,
  fromMinor: number,
  toMinor: number,
  currency: CurrencyCode
): StoredBudget {
  return {
    ...b,
    currency,
    totalCents: rescaleMinor(b.totalCents, fromMinor, toMinor),
    incomeSources: b.incomeSources?.map((src) => ({
      ...src,
      amountCents: rescaleMinor(src.amountCents, fromMinor, toMinor),
    })),
    carryInCents:
      b.carryInCents === undefined ? undefined : rescaleMinor(b.carryInCents, fromMinor, toMinor),
    carryOutCents:
      b.carryOutCents === undefined ? undefined : rescaleMinor(b.carryOutCents, fromMinor, toMinor),
    categories: b.categories.map((c) => ({
      ...c,
      allocatedCents: rescaleMinor(c.allocatedCents, fromMinor, toMinor),
    })),
  };
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
  await database.transaction(
    "rw",
    [
      database.budgets,
      database.obligations,
      database.payments,
      database.goals,
      database.contributions,
      database.expenses,
      database.settings,
    ],
    async () => {
      await Promise.all([
        database.budgets.clear(),
        database.obligations.clear(),
        database.payments.clear(),
        database.goals.clear(),
        database.contributions.clear(),
        database.expenses.clear(),
        database.settings.clear(),
      ]);
    }
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const database = getDB();
  if (!database) return undefined;
  return (await database.settings.get(key))?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const database = getDB();
  if (!database) return;
  await database.settings.put({ key, value });
}

// ---------------------------------------------------------------------------
// Currency switch: re-express every stored amount in the new currency's minor units
// ---------------------------------------------------------------------------

export async function switchCurrencyEverywhere(
  from: CurrencyCode,
  to: CurrencyCode
): Promise<void> {
  const database = getDB();
  if (!database) return;
  const f = CURRENCIES[from].minorUnitsPerMajor;
  const t = CURRENCIES[to].minorUnitsPerMajor;
  const r = (v: number) => rescaleMinor(v, f, t);
  await database.transaction(
    "rw",
    [
      database.budgets,
      database.obligations,
      database.payments,
      database.goals,
      database.contributions,
      database.expenses,
      database.settings,
    ],
    async () => {
      const [budgets, obligations, payments, goals, contributions, expenses] = await Promise.all([
        database.budgets.toArray(),
        database.obligations.toArray(),
        database.payments.toArray(),
        database.goals.toArray(),
        database.contributions.toArray(),
        database.expenses.toArray(),
      ]);
      await database.budgets.bulkPut(budgets.map((b) => rescaleBudget(b, f, t, to)));
      await database.obligations.bulkPut(
        obligations.map((o) => ({
          ...o,
          monthlyCents: r(o.monthlyCents),
          totalOwedCents: o.totalOwedCents === undefined ? undefined : r(o.totalOwedCents),
        }))
      );
      await database.payments.bulkPut(payments.map((p) => ({ ...p, amountCents: r(p.amountCents) })));
      await database.goals.bulkPut(
        goals.map((g) => ({
          ...g,
          targetCents: r(g.targetCents),
          startingSavedCents: r(g.startingSavedCents),
        }))
      );
      await database.contributions.bulkPut(
        contributions.map((c) => ({ ...c, amountCents: r(c.amountCents) }))
      );
      await database.expenses.bulkPut(expenses.map((e) => ({ ...e, amountCents: r(e.amountCents) })));
      await database.settings.put({ key: "currency", value: to });
    }
  );
}

// ---------------------------------------------------------------------------
// Backup & restore
// ---------------------------------------------------------------------------

/** Everything stored, for a backup file. */
export async function exportAllData(): Promise<BackupData | null> {
  const database = getDB();
  if (!database) return null;
  const [budgets, obligations, payments, goals, contributions, expenses, settings] =
    await Promise.all([
      database.budgets.toArray(),
      database.obligations.toArray(),
      database.payments.toArray(),
      database.goals.toArray(),
      database.contributions.toArray(),
      database.expenses.toArray(),
      database.settings.toArray(),
    ]);
  return { budgets, obligations, payments, goals, contributions, expenses, settings };
}

/**
 * Replace everything with a (validated) backup in one transaction: if anything fails,
 * the existing data stays exactly as it was.
 */
export async function replaceAllData(data: BackupData): Promise<void> {
  const database = getDB();
  if (!database) return;
  const tables = [
    database.budgets,
    database.obligations,
    database.payments,
    database.goals,
    database.contributions,
    database.expenses,
    database.settings,
  ];
  await database.transaction("rw", tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    await database.budgets.bulkPut(data.budgets);
    await database.obligations.bulkPut(data.obligations);
    await database.payments.bulkPut(data.payments);
    await database.goals.bulkPut(data.goals);
    await database.contributions.bulkPut(data.contributions);
    await database.expenses.bulkPut(data.expenses);
    await database.settings.bulkPut(data.settings);
  });
}
