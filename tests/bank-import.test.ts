import { describe, expect, it } from "vitest";
import {
  guessColumns,
  guessDateOrder,
  guessSignMode,
  parseBankAmount,
  parseBankDate,
  planImport,
  readBankCsv,
  type BankTable,
} from "@/lib/bank-import";

describe("amounts", () => {
  it.each([
    ["$1,234.56", 1234.56],
    ["-45.10", -45.1],
    ["(12.50)", -12.5],
    ["12.50 DR", -12.5],
    ["12.50 CR", 12.5],
    ["-1.234,56", -1234.56],
    ["1 234,56", 1234.56],
    ["12.50-", -12.5],
    ["-$9.99", -9.99],
    ["€ 7,5", 7.5],
  ])("%s", (raw, expected) => expect(parseBankAmount(raw)).toBeCloseTo(expected));

  it("rejects text", () => {
    expect(parseBankAmount("Groceries")).toBeNull();
    expect(parseBankAmount("")).toBeNull();
  });
});

describe("dates", () => {
  it("parses each order and rejects impossible days", () => {
    expect(parseBankDate("2026-11-03", "YMD")).toBe("2026-11-03");
    expect(parseBankDate("11/03/2026", "MDY")).toBe("2026-11-03");
    expect(parseBankDate("03.11.26", "DMY")).toBe("2026-11-03");
    expect(parseBankDate("31/02/2026", "DMY")).toBeNull();
    expect(parseBankDate("2026-11-03T10:00:00", "YMD")).toBe("2026-11-03");
  });

  it("guesses the order and says when it can't be sure", () => {
    expect(guessDateOrder(["2026-11-03"])).toEqual({ order: "YMD", certain: true });
    expect(guessDateOrder(["25/11/2026", "03/11/2026"])).toEqual({ order: "DMY", certain: true });
    expect(guessDateOrder(["11/25/2026"])).toEqual({ order: "MDY", certain: true });
    expect(guessDateOrder(["03/11/2026"]).certain).toBe(false);
  });
});

const usBank = `Account: Everyday Checking,,,
Date,Description,Amount,Balance
11/03/2026,"WHOLE FOODS, AUSTIN",-82.15,1917.85
11/04/2026,PAYROLL ACME,3000.00,4917.85
11/25/2026,Netflix,-15.99,4901.86
11/26/2026,,abc,4901.86`;

describe("reading a bank file", () => {
  const table = readBankCsv(usBank) as BankTable;

  it("skips account lines above the header", () => {
    expect(table.headers).toEqual(["Date", "Description", "Amount", "Balance"]);
    expect(table.rows).toHaveLength(4);
  });

  it("finds date, amount (not balance) and description", () => {
    expect(guessColumns(table)).toEqual({ date: 0, amount: 2, description: 1 });
    expect(guessSignMode(table, 2)).toBe("negatives");
  });

  it("plans the import: spending only, duplicates flagged, bad rows counted", () => {
    const plan = planImport(table, {
      columns: { date: 0, amount: 2, description: 1 },
      dateOrder: "MDY",
      signMode: "negatives",
      minorUnitsPerMajor: 100,
      existing: [{ date: "2026-11-25", amountCents: 1599, note: "netflix" }],
    });
    expect(plan.rows).toEqual([
      { date: "2026-11-03", monthKey: "2026-11", description: "WHOLE FOODS, AUSTIN", amountCents: 8215, duplicate: false },
      { date: "2026-11-25", monthKey: "2026-11", description: "Netflix", amountCents: 1599, duplicate: true },
    ]);
    expect(plan.skippedCredits).toBe(1);
    expect(plan.skippedInvalid).toBe(1);
  });

  it("uses a debit column when there is one", () => {
    const t = readBankCsv("Datum;Text;Debit;Credit\n03.11.2026;Rewe;45,10;\n04.11.2026;Lohn;;3000,00") as BankTable;
    const cols = guessColumns(t);
    expect(cols).toEqual({ date: 0, amount: 2, description: 1 });
    const plan = planImport(t, {
      columns: cols,
      dateOrder: "DMY",
      signMode: guessSignMode(t, cols.amount),
      minorUnitsPerMajor: 100,
      existing: [],
    });
    expect(plan.rows.map((r) => [r.date, r.amountCents])).toEqual([["2026-11-03", 4510]]);
  });

  it("refuses empty files", () => {
    expect(readBankCsv("Date,Amount")).toEqual({ error: "This file has no rows to import." });
  });
});
