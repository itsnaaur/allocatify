import { describe, expect, it } from "vitest";
import { upgradeLegacyBudget } from "@/lib/legacy-upgrade";

const cat = (id: string, name: string, allocatedCents: number) => ({ id, name, allocatedCents });

describe("upgrading budgets saved before this update", () => {
  it("untouched 50/30/20 split follows the template again and Needs is a must-have", () => {
    const out = upgradeLegacyBudget({
      totalCents: 500000,
      activeTemplateId: "50-30-20",
      categories: [cat("needs", "Needs", 250000), cat("wants", "Wants", 150000), cat("savings", "Savings", 100000)],
    });
    expect(out.autoScale).toBe(true);
    expect(out.categories.map((c) => c.essential)).toEqual([true, undefined, undefined]);
    expect(out.categories.map((c) => c.percentage)).toEqual([50, 30, 20]);
  });

  it("matches copied months by name (their ids were regenerated)", () => {
    const out = upgradeLegacyBudget({
      totalCents: 500000,
      activeTemplateId: "50-30-20",
      categories: [cat("cat_1", "Needs", 250000), cat("cat_2", "Wants", 150000), cat("cat_3", "Savings", 100000)],
    });
    expect(out.autoScale).toBe(true);
    expect(out.categories[0].essential).toBe(true);
  });

  it("keeps hand-edited amounts but still marks the must-have", () => {
    const out = upgradeLegacyBudget({
      totalCents: 500000,
      activeTemplateId: "50-30-20",
      categories: [cat("needs", "Needs", 300000), cat("wants", "Wants", 100000), cat("savings", "Savings", 100000)],
    });
    expect(out.autoScale).toBe(false);
    expect(out.categories.map((c) => c.allocatedCents)).toEqual([300000, 100000, 100000]);
    expect(out.categories[0].essential).toBe(true);
  });

  it("leaves custom category lists alone", () => {
    const cats = [cat("a", "Rent", 100000), cat("b", "Food", 50000)];
    const out = upgradeLegacyBudget({ totalCents: 150000, activeTemplateId: "50-30-20", categories: cats });
    expect(out).toEqual({ categories: cats, autoScale: false });
  });

  it("never overrides a choice saved by the new version", () => {
    const out = upgradeLegacyBudget({
      totalCents: 500000,
      activeTemplateId: "50-30-20",
      autoScale: false,
      categories: [cat("needs", "Needs", 250000), cat("wants", "Wants", 150000), cat("savings", "Savings", 100000)],
    });
    expect(out.autoScale).toBe(false);
  });

  it("does not undo a must-have the user unticked", () => {
    const out = upgradeLegacyBudget({
      totalCents: 0,
      activeTemplateId: "50-30-20",
      autoScale: true,
      categories: [{ ...cat("needs", "Needs", 0), essential: false }, cat("wants", "Wants", 0), cat("savings", "Savings", 0)],
    });
    expect(out.categories[0].essential).toBe(false);
  });
});
