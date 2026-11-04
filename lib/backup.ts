/**
 * Backup file: everything Allocatify stores, in one JSON file the user keeps.
 * Restoring reads a file the user picked, so every record is checked before any of it
 * is written; a bad file is rejected as a whole and nothing changes.
 */

import type { StoredBudget, Setting } from "./db";
import type { Contribution, Expense, Goal, Obligation, Payment } from "./finance";
import { CURRENCIES } from "./currencies";
import { clampBufferPercent } from "./finance";

export const BACKUP_APP = "allocatify";
export const BACKUP_FORMAT = 1;
/** Files larger than this are refused before parsing (a real backup is far smaller). */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export interface BackupData {
  budgets: StoredBudget[];
  obligations: Obligation[];
  payments: Payment[];
  goals: Goal[];
  contributions: Contribution[];
  expenses: Expense[];
  settings: Setting[];
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  data: BackupData;
}

export function buildBackup(data: BackupData, now = new Date()): BackupFile {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now.toISOString(), data };
}

export function backupFileName(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `allocatify-backup-${y}-${m}-${d}.json`;
}

export interface BackupSummary {
  exportedAt: string;
  months: number;
  firstMonth: string | null;
  lastMonth: string | null;
  loansAndBills: number;
  goals: number;
  expenses: number;
  currency: string;
}

export function summarizeBackup(file: BackupFile): BackupSummary {
  const keys = file.data.budgets.map((b) => b.monthKey ?? b.id).sort();
  const currency = file.data.settings.find((s) => s.key === "currency")?.value;
  return {
    exportedAt: file.exportedAt,
    months: keys.length,
    firstMonth: keys[0] ?? null,
    lastMonth: keys[keys.length - 1] ?? null,
    loansAndBills: file.data.obligations.length,
    goals: file.data.goals.length,
    expenses: file.data.expenses.length,
    currency: typeof currency === "string" ? currency : "USD",
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ParseResult = { ok: true; file: BackupFile } | { ok: false; error: string };

class Invalid extends Error {}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MAX_TEXT = 200;
/** Far above any real amount; stops absurd numbers from breaking the maths. */
const MAX_AMOUNT = 1e15;

function obj(v: unknown, where: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Invalid(`${where} is not an object`);
  return v as Record<string, unknown>;
}
function arr(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) throw new Invalid(`${where} is missing or not a list`);
  return v;
}
function str(v: unknown, where: string, max = MAX_TEXT): string {
  if (typeof v !== "string" || v.length === 0 || v.length > max) throw new Invalid(`${where} is not valid text`);
  return v;
}
function optStr(v: unknown, where: string, max = MAX_TEXT): string | undefined {
  return v === undefined || v === null ? undefined : str(v, where, max);
}
function amount(v: unknown, where: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_AMOUNT)
    throw new Invalid(`${where} is not a valid amount`);
  return v;
}
function optAmount(v: unknown, where: string): number | undefined {
  return v === undefined || v === null ? undefined : amount(v, where);
}
function time(v: unknown, where: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Invalid(`${where} is not a valid time`);
  return v;
}
function month(v: unknown, where: string): string {
  if (typeof v !== "string" || !MONTH.test(v)) throw new Invalid(`${where} is not a month (YYYY-MM)`);
  return v;
}
function optMonth(v: unknown, where: string): string | undefined {
  return v === undefined || v === null ? undefined : month(v, where);
}
function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}
function color(v: unknown): string | undefined {
  return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : undefined;
}
function uniqueIds<T extends { id: string }>(items: T[], where: string): T[] {
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.id)) throw new Invalid(`${where} has a duplicate id`);
    seen.add(it.id);
  }
  return items;
}

function parseBudget(v: unknown, i: number): StoredBudget {
  const w = `Month ${i + 1}`;
  const b = obj(v, w);
  const id = month(b.id, `${w} id`);
  const categories = arr(b.categories, `${w} categories`).map((c, j) => {
    const cw = `${w}, category ${j + 1}`;
    const o = obj(c, cw);
    const pct = o.percentage;
    if (pct !== undefined && (typeof pct !== "number" || pct < 0 || pct > 100))
      throw new Invalid(`${cw} percentage is not valid`);
    return {
      id: str(o.id, `${cw} id`),
      name: str(o.name, `${cw} name`, 80),
      allocatedCents: amount(o.allocatedCents, `${cw} amount`),
      color: color(o.color),
      percentage: pct as number | undefined,
      essential: bool(o.essential),
    };
  });
  const incomeSources =
    b.incomeSources === undefined || b.incomeSources === null
      ? undefined
      : uniqueIds(
          arr(b.incomeSources, `${w} income`).map((x, j) => {
            const iw = `${w}, income ${j + 1}`;
            const o = obj(x, iw);
            const payDay = o.payDay;
            if (
              payDay !== undefined &&
              payDay !== null &&
              (typeof payDay !== "number" || !Number.isInteger(payDay) || payDay < 1 || payDay > 31)
            )
              throw new Invalid(`${iw} pay day is not valid`);
            return {
              id: str(o.id, `${iw} id`),
              name: str(o.name, `${iw} name`, 80),
              amountCents: amount(o.amountCents, `${iw} amount`),
              payDay: (payDay ?? undefined) as number | undefined,
            };
          }),
          `${w} income`
        );
  return {
    id,
    name: str(b.name, `${w} name`, 80),
    incomeSources,
    monthKey: optMonth(b.monthKey, `${w} month`) ?? id,
    totalCents: amount(b.totalCents, `${w} income`),
    categories: uniqueIds(categories, `${w} categories`),
    currency: optStr(b.currency, `${w} currency`, 8),
    activeTemplateId: optStr(b.activeTemplateId, `${w} template`, 40),
    autoScale: bool(b.autoScale),
    carryInCents: optAmount(b.carryInCents, `${w} carried-in amount`),
    carryInFrom: optMonth(b.carryInFrom, `${w} carried-in month`),
    carryOutCents: optAmount(b.carryOutCents, `${w} carried-out amount`),
    carryOutHandled: bool(b.carryOutHandled),
    createdAt: time(b.createdAt ?? 0, `${w} created`),
    updatedAt: time(b.updatedAt ?? 0, `${w} updated`),
  };
}

function parseObligation(v: unknown, i: number): Obligation {
  const w = `Loan/bill ${i + 1}`;
  const o = obj(v, w);
  if (o.kind !== "loan" && o.kind !== "bill") throw new Invalid(`${w} type is not valid`);
  const dueDay = o.dueDay;
  if (typeof dueDay !== "number" || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
    throw new Invalid(`${w} due day is not valid`);
  return {
    id: str(o.id, `${w} id`),
    kind: o.kind,
    name: str(o.name, `${w} name`, 80),
    monthlyCents: amount(o.monthlyCents, `${w} monthly payment`),
    dueDay,
    startMonthKey: month(o.startMonthKey, `${w} first payment`),
    totalOwedCents: o.kind === "loan" ? amount(o.totalOwedCents, `${w} total owed`) : undefined,
    createdAt: time(o.createdAt ?? 0, `${w} created`),
  };
}

function parsePayment(v: unknown, i: number): Payment {
  const w = `Payment ${i + 1}`;
  const o = obj(v, w);
  return {
    id: str(o.id, `${w} id`),
    obligationId: str(o.obligationId, `${w} loan/bill`),
    monthKey: month(o.monthKey, `${w} month`),
    amountCents: amount(o.amountCents, `${w} amount`),
    paidAt: time(o.paidAt ?? 0, `${w} paid date`),
  };
}

function parseGoal(v: unknown, i: number): Goal {
  const w = `Goal ${i + 1}`;
  const o = obj(v, w);
  const p = o.priority;
  if (p !== 1 && p !== 2 && p !== 3) throw new Invalid(`${w} priority is not valid`);
  return {
    id: str(o.id, `${w} id`),
    name: str(o.name, `${w} name`, 80),
    targetCents: amount(o.targetCents, `${w} price`),
    startingSavedCents: amount(o.startingSavedCents ?? 0, `${w} already saved`),
    deadlineMonthKey: optMonth(o.deadlineMonthKey, `${w} target date`),
    priority: p,
    createdAt: time(o.createdAt ?? 0, `${w} created`),
  };
}

function parseContribution(v: unknown, i: number): Contribution {
  const w = `Goal saving ${i + 1}`;
  const o = obj(v, w);
  return {
    id: str(o.id, `${w} id`),
    goalId: str(o.goalId, `${w} goal`),
    monthKey: month(o.monthKey, `${w} month`),
    amountCents: amount(o.amountCents, `${w} amount`),
    savedAt: time(o.savedAt ?? 0, `${w} date`),
  };
}

function parseExpense(v: unknown, i: number): Expense {
  const w = `Expense ${i + 1}`;
  const o = obj(v, w);
  const date = o.date;
  if (typeof date !== "string" || !DATE.test(date)) throw new Invalid(`${w} date is not valid`);
  const monthKey = month(o.monthKey, `${w} month`);
  if (!date.startsWith(monthKey)) throw new Invalid(`${w} date is outside its month`);
  return {
    id: str(o.id, `${w} id`),
    monthKey,
    date,
    amountCents: amount(o.amountCents, `${w} amount`),
    categoryId: o.categoryId === null || o.categoryId === undefined ? null : str(o.categoryId, `${w} category`),
    note: optStr(o.note, `${w} note`, 80),
    createdAt: time(o.createdAt ?? 0, `${w} created`),
  };
}

/** Only known settings are restored; anything else in the file is ignored. */
function parseSettings(v: unknown): Setting[] {
  const out: Setting[] = [];
  for (const raw of arr(v, "Settings")) {
    const s = obj(raw, "A setting");
    if (s.key === "currency") {
      if (typeof s.value !== "string" || !(s.value in CURRENCIES))
        throw new Invalid("The currency setting is not a supported currency");
      out.push({ key: "currency", value: s.value });
    } else if (s.key === "bufferPercent") {
      if (typeof s.value !== "number") throw new Invalid("The safety buffer setting is not a number");
      out.push({ key: "bufferPercent", value: clampBufferPercent(s.value) });
    }
  }
  return out;
}

/** Check a backup file's text. Never throws; returns a reason when it can't be used. */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: "This file is too large to be an Allocatify backup." };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't a valid backup (it's not readable JSON)." };
  }
  try {
    const root = obj(json, "The file");
    if (root.app !== BACKUP_APP) throw new Invalid("This isn't an Allocatify backup file");
    if (root.format !== BACKUP_FORMAT)
      throw new Invalid("This backup was made by a different version of Allocatify");
    const d = obj(root.data, "The backup data");
    const data: BackupData = {
      budgets: uniqueIds(arr(d.budgets, "Months").map(parseBudget), "Months"),
      obligations: uniqueIds(arr(d.obligations, "Loans & bills").map(parseObligation), "Loans & bills"),
      payments: uniqueIds(arr(d.payments, "Payments").map(parsePayment), "Payments"),
      goals: uniqueIds(arr(d.goals, "Goals").map(parseGoal), "Goals"),
      contributions: uniqueIds(arr(d.contributions, "Goal savings").map(parseContribution), "Goal savings"),
      expenses: uniqueIds(arr(d.expenses, "Expenses").map(parseExpense), "Expenses"),
      settings: parseSettings(d.settings ?? []),
    };
    // Records must point at things that exist in the same backup.
    const obIds = new Set(data.obligations.map((o) => o.id));
    if (data.payments.some((p) => !obIds.has(p.obligationId)))
      throw new Invalid("A payment belongs to a loan or bill that isn't in the backup");
    const goalIds = new Set(data.goals.map((g) => g.id));
    if (data.contributions.some((c) => !goalIds.has(c.goalId)))
      throw new Invalid("A goal saving belongs to a goal that isn't in the backup");
    const exportedAt = typeof root.exportedAt === "string" ? root.exportedAt : "";
    return { ok: true, file: { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt, data } };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: `${e.message}. Nothing was changed.` };
    return { ok: false, error: "This backup couldn't be read. Nothing was changed." };
  }
}
