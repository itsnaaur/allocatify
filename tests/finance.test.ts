import { describe, expect, it } from "vitest";
import {
  buildMonthPlan,
  clampBufferPercent,
  dueDateInMonth,
  dueStatus,
  loanSummary,
  monthHealth,
  obligationDueInMonth,
  planGoals,
  splitFreeMoney,
  type Goal,
  type Obligation,
  type Payment,
} from "@/lib/finance";

const loan: Obligation = {
  id: "car",
  kind: "loan",
  name: "Car loan",
  monthlyCents: 35000,
  dueDay: 15,
  startMonthKey: "2026-12",
  totalOwedCents: 630000,
  createdAt: 0,
};

const pay = (monthKey: string, amountCents = 35000): Payment => ({
  id: `car_${monthKey}`,
  obligationId: "car",
  monthKey,
  amountCents,
  paidAt: 0,
});

describe("loans", () => {
  it("counts months left and payoff month", () => {
    const s = loanSummary(loan, []);
    expect(s.monthsLeft).toBe(18);
    expect(s.finalPaymentCents).toBe(35000);
    expect(s.payoffMonthKey).toBe("2028-05");
  });

  it("handles an uneven last payment", () => {
    const s = loanSummary({ ...loan, totalOwedCents: 640000 }, []);
    expect(s.monthsLeft).toBe(19);
    expect(s.finalPaymentCents).toBe(10000);
    expect(s.payoffMonthKey).toBe("2028-06");
  });

  it("counts down when payments are marked", () => {
    const s = loanSummary(loan, [pay("2026-12"), pay("2027-01")]);
    expect(s.remainingCents).toBe(560000);
    expect(s.monthsLeft).toBe(16);
    expect(s.payoffMonthKey).toBe("2028-05");
  });

  it("is due only from its start month until paid off", () => {
    expect(obligationDueInMonth(loan, "2026-11", [])).toBe(0);
    expect(obligationDueInMonth(loan, "2026-12", [])).toBe(35000);
    expect(obligationDueInMonth({ ...loan, totalOwedCents: 640000 }, "2028-06", [])).toBe(10000);
    expect(obligationDueInMonth(loan, "2028-06", [])).toBe(0);
  });

  it("reports paid off", () => {
    const payments = [pay("2026-12", 630000)];
    expect(loanSummary(loan, payments).isPaidOff).toBe(true);
    expect(obligationDueInMonth(loan, "2027-01", payments)).toBe(0);
  });

  it("bills are due every month from the start", () => {
    const bill: Obligation = { ...loan, kind: "bill", totalOwedCents: undefined };
    expect(obligationDueInMonth(bill, "2035-01", [])).toBe(35000);
  });
});

describe("due dates", () => {
  it("clamps day 31 to the end of short months", () => {
    expect(dueDateInMonth(31, "2027-02").getDate()).toBe(28);
  });

  it("classifies status", () => {
    const today = new Date(2026, 11, 10); // Dec 10
    expect(dueStatus(15, "2026-12", false, today)).toEqual({ kind: "due-soon", days: 5 });
    expect(dueStatus(5, "2026-12", false, today)).toEqual({ kind: "overdue", days: 5 });
    expect(dueStatus(10, "2026-12", false, today)).toEqual({ kind: "due-today" });
    expect(dueStatus(5, "2026-12", true, today)).toEqual({ kind: "paid" });
  });
});

describe("safety buffer", () => {
  it("never goes below 10% or above 50%", () => {
    expect(clampBufferPercent(0)).toBe(10);
    expect(clampBufferPercent(5)).toBe(10);
    expect(clampBufferPercent(25)).toBe(25);
    expect(clampBufferPercent(90)).toBe(50);
    expect(clampBufferPercent(NaN)).toBe(10);
  });

  it("is enforced inside the plan too", () => {
    const plan = buildMonthPlan({
      incomeCents: 300000,
      fixedCents: 0,
      essentialCents: 0,
      otherSpendingCents: 0,
      bufferPercent: 0,
    });
    expect(plan.bufferPercent).toBe(10);
    expect(plan.bufferCents).toBe(30000);
  });
});

describe("month plan", () => {
  // Salary 3000, loan 350, bills 900, must-haves 800, buffer 10% = 300 → 650 free
  const plan = buildMonthPlan({
    incomeCents: 300000,
    fixedCents: 125000,
    essentialCents: 80000,
    otherSpendingCents: 0,
    bufferPercent: 10,
  });

  it("only offers money left after must-haves and buffer", () => {
    expect(plan.freeToSaveCents).toBe(65000);
  });

  it("flags dipping into the buffer", () => {
    expect(monthHealth(plan, 65000)).toEqual({ kind: "ok", leftCents: 30000 });
    expect(monthHealth({ ...plan, otherSpendingCents: 10000 }, 65000)).toEqual({
      kind: "into-buffer",
      shortCents: 10000,
    });
    expect(monthHealth({ ...plan, otherSpendingCents: 40000 }, 65000)).toEqual({
      kind: "over-budget",
      overCents: 10000,
    });
  });
});

describe("goals", () => {
  const laptop: Goal = {
    id: "laptop",
    name: "Laptop",
    targetCents: 150000,
    startingSavedCents: 20000,
    priority: 2,
    createdAt: 0,
  };

  it("suggests from free money and counts months to afford", () => {
    const [p] = planGoals([laptop], [], 65000, "2026-12");
    expect(p.suggestedCents).toBe(65000);
    expect(p.monthsToAfford).toBe(2);
    expect(p.affordMonthKey).toBe("2027-01");
  });

  it("never suggests more than the goal still needs", () => {
    const [p] = planGoals([{ ...laptop, startingSavedCents: 140000 }], [], 65000, "2026-12");
    expect(p.suggestedCents).toBe(10000);
    expect(p.monthsToAfford).toBe(1);
  });

  it("checks deadlines", () => {
    const [p] = planGoals([{ ...laptop, deadlineMonthKey: "2026-12" }], [], 65000, "2026-12");
    expect(p.deadline).toEqual({ monthsAvailable: 1, requiredMonthlyCents: 130000, feasible: false });
  });

  it("can't save when there is no free money", () => {
    const [p] = planGoals([laptop], [], 0, "2026-12");
    expect(p.suggestedCents).toBe(0);
    expect(p.monthsToAfford).toBeNull();
  });

  it("uses this month's recorded saving and tracks progress", () => {
    const [p] = planGoals(
      [laptop],
      [{ id: "laptop_2026-12", goalId: "laptop", monthKey: "2026-12", amountCents: 50000, savedAt: 0 }],
      65000,
      "2026-12"
    );
    expect(p.plannedCents).toBe(50000);
    expect(p.savedCents).toBe(70000);
  });

  it("splits by priority and passes on money a goal can't use", () => {
    const shares = splitFreeMoney(90000, [
      { id: "a", weight: 2, needCents: 10000 },
      { id: "b", weight: 1, needCents: 1_000_000 },
    ]);
    expect(shares.get("a")).toBe(10000);
    expect(shares.get("b")).toBe(80000);
  });

  it("split always adds up exactly", () => {
    const shares = splitFreeMoney(100, [
      { id: "a", weight: 1, needCents: 1000 },
      { id: "b", weight: 1, needCents: 1000 },
      { id: "c", weight: 1, needCents: 1000 },
    ]);
    expect([...shares.values()].reduce((s, v) => s + v, 0)).toBe(100);
  });
});

describe("carry-in", () => {
  it("adds to money free to save but not to the buffer base", async () => {
    const plan = buildMonthPlan({
      incomeCents: 300000,
      carryInCents: 20000,
      fixedCents: 125000,
      essentialCents: 80000,
      otherSpendingCents: 0,
      bufferPercent: 10,
    });
    expect(plan.bufferCents).toBe(30000);
    expect(plan.freeToSaveCents).toBe(85000);
  });
});

describe("month leftover", () => {
  it("uses spent where tracked and planned where not", async () => {
    const { monthLeftover, spentByCategory } = await import("@/lib/finance");
    const spent = spentByCategory(
      [
        { id: "1", monthKey: "2026-11", date: "2026-11-03", amountCents: 50000, categoryId: "food", createdAt: 0 },
        { id: "2", monthKey: "2026-11", date: "2026-11-09", amountCents: 10000, categoryId: "food", createdAt: 0 },
        { id: "3", monthKey: "2026-11", date: "2026-11-09", amountCents: 5000, categoryId: null, createdAt: 0 },
        { id: "4", monthKey: "2026-12", date: "2026-12-01", amountCents: 99999, categoryId: "food", createdAt: 0 },
      ],
      "2026-11"
    );
    expect(spent.get("food")).toBe(60000);
    const left = monthLeftover({
      incomeCents: 300000,
      carryInCents: 0,
      fixedCents: 125000,
      categories: [
        { id: "food", allocatedCents: 80000 }, // tracked: 600 spent
        { id: "fun", allocatedCents: 20000 }, // not tracked: planned 200 counts
      ],
      spent,
      goalSavedCents: 50000,
      carriedOutCents: 0,
    });
    // 3000 - 1250 - 600 - 200 - 50 uncategorized - 500 goal = 400
    expect(left).toBe(40000);
  });

  it("drops to zero once carried out", async () => {
    const { monthLeftover } = await import("@/lib/finance");
    expect(
      monthLeftover({
        incomeCents: 100000,
        carryInCents: 0,
        fixedCents: 0,
        categories: [],
        spent: new Map(),
        goalSavedCents: 0,
        carriedOutCents: 100000,
      })
    ).toBe(0);
  });
});

describe("goal savings in one month", () => {
  it("adds a carried-over amount to the monthly saving", () => {
    const [p] = planGoals(
      [{ id: "g", name: "G", targetCents: 100000, startingSavedCents: 0, priority: 2, createdAt: 0 }],
      [
        { id: "g_2026-11", goalId: "g", monthKey: "2026-11", amountCents: 10000, savedAt: 0 },
        { id: "g_2026-11_carry", goalId: "g", monthKey: "2026-11", amountCents: 5000, savedAt: 0 },
      ],
      0,
      "2026-11"
    );
    expect(p.savedThisMonthCents).toBe(15000);
  });
});

describe("goal progress by month", () => {
  it("ignores savings made in later months", () => {
    const [p] = planGoals(
      [{ id: "g", name: "G", targetCents: 150000, startingSavedCents: 20000, priority: 2, createdAt: 0 }],
      [{ id: "g_2026-11", goalId: "g", monthKey: "2026-11", amountCents: 50000, savedAt: 0 }],
      0,
      "2026-10"
    );
    expect(p.savedCents).toBe(20000);
    expect(p.remainingBeforeMonthCents).toBe(130000);
  });
});
