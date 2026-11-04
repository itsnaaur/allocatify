import { describe, expect, it } from "vitest";
import { buildMonthReport } from "@/lib/report";
import { reportsCSV } from "@/lib/export-utils";
import { parseCsvRows } from "@/lib/csv";

const budget = {
  id: "2026-11",
  name: "November 2026",
  monthKey: "2026-11",
  totalCents: 300000,
  carryInCents: 20000,
  carryInFrom: "2026-10",
  categories: [
    { id: "needs", name: "Needs", allocatedCents: 80000, essential: true },
    { id: "fun", name: "Fun", allocatedCents: 20000 },
  ],
  createdAt: 0,
  updatedAt: 0,
};

const data = {
  obligations: [
    { id: "car", kind: "loan" as const, name: "Car loan", monthlyCents: 35000, dueDay: 15, startMonthKey: "2026-11", totalOwedCents: 640000, createdAt: 0 },
    { id: "rent", kind: "bill" as const, name: "Rent", monthlyCents: 90000, dueDay: 1, startMonthKey: "2026-11", createdAt: 0 },
  ],
  payments: [{ id: "car_2026-11", obligationId: "car", monthKey: "2026-11", amountCents: 35000, paidAt: 0 }],
  goals: [{ id: "laptop", name: "Laptop", targetCents: 150000, startingSavedCents: 20000, priority: 2 as const, createdAt: 0 }],
  contributions: [
    { id: "laptop_2026-11", goalId: "laptop", monthKey: "2026-11", amountCents: 50000, savedAt: 0 },
    { id: "laptop_2026-12", goalId: "laptop", monthKey: "2026-12", amountCents: 50000, savedAt: 0 },
  ],
  expenses: [
    { id: "e1", monthKey: "2026-11", date: "2026-11-03", amountCents: 60000, categoryId: "needs", note: "Groceries", createdAt: 0 },
    { id: "e2", monthKey: "2026-11", date: "2026-11-04", amountCents: 5000, categoryId: null, createdAt: 0 },
    { id: "e3", monthKey: "2026-12", date: "2026-12-01", amountCents: 999, categoryId: "needs", createdAt: 0 },
  ],
};

describe("month report", () => {
  const r = buildMonthReport(budget, data);

  it("lists loans and bills by due day with what's left on loans", () => {
    expect(r.fixed.map((f) => f.name)).toEqual(["Rent", "Car loan"]);
    expect(r.fixed[1]).toMatchObject({ paidCents: 35000, remainingCents: 605000, monthsLeft: 18 });
    expect(r.fixed[0].paidCents).toBeNull();
  });

  it("puts spending against plan, only this month", () => {
    expect(r.categories).toEqual([
      { name: "Needs", plannedCents: 80000, spentCents: 60000, essential: true },
      { name: "Fun", plannedCents: 20000, spentCents: null, essential: false },
    ]);
    expect(r.uncategorizedSpentCents).toBe(5000);
    expect(r.expenses.map((e) => e.description)).toEqual(["Groceries", "Uncategorized"]);
  });

  it("counts goal savings up to this month only", () => {
    expect(r.goals[0]).toMatchObject({ savedThisMonthCents: 50000, savedToDateCents: 70000 });
  });

  it("works out what was left", () => {
    // 3000 + 200 - 1250 bills - 600 needs - 200 fun (planned) - 50 uncategorized - 500 goal
    expect(r.totals.leftCents).toBe(60000);
  });

  it("exports a CSV that reads back with every section", () => {
    const rows = parseCsvRows(reportsCSV([r], "USD"));
    const sections = new Set(rows.map((row) => row[0]));
    for (const s of ["Income", "Loans & bills", "Spending", "Goals", "Summary", "Date"]) {
      expect(sections.has(s)).toBe(true);
    }
    expect(rows).toContainEqual(["Spending", "Needs", "800.00", "600.00", "Must-have"]);
    expect(rows).toContainEqual(["2026-11-03", "Groceries", "Needs", "600.00"]);
  });
});

describe("trends", () => {
  it("splits each month's income and tracks debt going down", async () => {
    const { buildTrends } = await import("@/lib/trends");
    const dec = { ...budget, id: "2026-12", monthKey: "2026-12", name: "December 2026", carryInCents: 0, carryInFrom: undefined };
    const pts = buildTrends([dec, budget], {
      ...data,
      payments: [...data.payments, { id: "car_2026-12", obligationId: "car", monthKey: "2026-12", amountCents: 35000, paidAt: 0 }],
    });
    expect(pts.map((p) => p.monthKey)).toEqual(["2026-11", "2026-12"]);
    const [nov, decPt] = pts;
    // Nov: 3200 in; 1250 bills; 600 needs + 200 fun planned + 50 uncategorized; 500 saved
    expect(nov).toMatchObject({ incomeCents: 320000, fixedCents: 125000, spendingCents: 85000, savedCents: 50000, leftCents: 60000, overspentCents: 0 });
    expect(nov.fixedCents + nov.spendingCents + nov.savedCents + nov.leftCents).toBe(nov.incomeCents);
    expect(decPt.debtCents!).toBeLessThan(nov.debtCents!);
  });
});
