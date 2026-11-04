import { describe, expect, it } from "vitest";
import { buildBackup, parseBackup, summarizeBackup, backupFileName, type BackupData } from "@/lib/backup";

const data: BackupData = {
  budgets: [
    {
      id: "2026-11",
      name: "November 2026",
      monthKey: "2026-11",
      totalCents: 300000,
      categories: [{ id: "needs", name: "Needs", allocatedCents: 72500, color: "#22c55e", percentage: 50, essential: true }],
      currency: "USD",
      activeTemplateId: "50-30-20",
      autoScale: true,
      carryInCents: 125000,
      carryInFrom: "2026-10",
      createdAt: 1,
      updatedAt: 2,
    },
  ],
  obligations: [
    { id: "car", kind: "loan", name: "Car loan", monthlyCents: 35000, dueDay: 15, startMonthKey: "2026-11", totalOwedCents: 640000, createdAt: 1 },
    { id: "rent", kind: "bill", name: "Rent", monthlyCents: 90000, dueDay: 1, startMonthKey: "2026-11", createdAt: 1 },
  ],
  payments: [{ id: "car_2026-11", obligationId: "car", monthKey: "2026-11", amountCents: 35000, paidAt: 1 }],
  goals: [{ id: "laptop", name: "Laptop", targetCents: 150000, startingSavedCents: 20000, priority: 2, createdAt: 1 }],
  contributions: [{ id: "laptop_2026-11", goalId: "laptop", monthKey: "2026-11", amountCents: 50000, savedAt: 1 }],
  expenses: [{ id: "e1", monthKey: "2026-11", date: "2026-11-03", amountCents: 1200, categoryId: "needs", note: "Groceries", createdAt: 1 }],
  settings: [
    { key: "currency", value: "USD" },
    { key: "bufferPercent", value: 15 },
  ],
};

const text = (o: unknown) => JSON.stringify(o);
const withData = (patch: Partial<Record<keyof BackupData, unknown>>) =>
  text({ ...buildBackup(data), data: { ...data, ...patch } });

describe("backup round trip", () => {
  it("restores exactly what was saved", () => {
    const file = buildBackup(data, new Date("2026-11-05T10:00:00Z"));
    const parsed = parseBackup(text(file));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.file.data).toEqual(data);
  });

  it("summarizes what's inside", () => {
    expect(summarizeBackup(buildBackup(data))).toMatchObject({
      months: 1,
      firstMonth: "2026-11",
      loansAndBills: 2,
      goals: 1,
      expenses: 1,
      currency: "USD",
    });
  });

  it("names the file by date", () => {
    expect(backupFileName(new Date(2026, 10, 5))).toBe("allocatify-backup-2026-11-05.json");
  });
});

describe("rejects bad files without changing anything", () => {
  const bad = (t: string) => {
    const r = parseBackup(t);
    expect(r.ok).toBe(false);
    return r.ok ? "" : r.error;
  };

  it("not JSON", () => expect(bad("hello")).toMatch(/not readable JSON/));
  it("another app's JSON", () => expect(bad(text({ app: "other", data: {} }))).toMatch(/isn't an Allocatify backup/));
  it("a newer format", () => expect(bad(text({ ...buildBackup(data), format: 99 }))).toMatch(/different version/));
  it("negative amount", () =>
    expect(bad(withData({ expenses: [{ ...data.expenses[0], amountCents: -5 }] }))).toMatch(/Expense 1 amount/));
  it("fractional cents", () =>
    expect(bad(withData({ goals: [{ ...data.goals[0], targetCents: 1.5 }] }))).toMatch(/Goal 1 price/));
  it("bad month", () =>
    expect(bad(withData({ obligations: [{ ...data.obligations[0], startMonthKey: "2026-13" }] }))).toMatch(/first payment/));
  it("expense outside its month", () =>
    expect(bad(withData({ expenses: [{ ...data.expenses[0], date: "2026-12-01" }] }))).toMatch(/outside its month/));
  it("payment for a missing loan", () =>
    expect(bad(withData({ obligations: [data.obligations[1]] }))).toMatch(/isn't in the backup/));
  it("duplicate ids", () => expect(bad(withData({ goals: [data.goals[0], data.goals[0]] }))).toMatch(/duplicate/));
  it("unsupported currency", () =>
    expect(bad(withData({ settings: [{ key: "currency", value: "XYZ" }] }))).toMatch(/currency/));
  it("too large", () => expect(bad("x".repeat(10 * 1024 * 1024 + 1))).toMatch(/too large/));
  it("always says nothing changed", () =>
    expect(bad(withData({ budgets: "nope" }))).toMatch(/Nothing was changed/));
});

describe("cleans what it keeps", () => {
  it("drops unknown settings and fields, enforces the 10% buffer floor", () => {
    const r = parseBackup(
      withData({
        settings: [{ key: "bufferPercent", value: 2 }, { key: "evil", value: "<script>" }],
        budgets: [{ ...data.budgets[0], extra: "ignored", categories: [{ ...data.budgets[0].categories[0], color: "javascript:x" }] }],
      })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.data.settings).toEqual([{ key: "bufferPercent", value: 10 }]);
    expect("extra" in r.file.data.budgets[0]).toBe(false);
    expect(r.file.data.budgets[0].categories[0].color).toBeUndefined();
  });
});
