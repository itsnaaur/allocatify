import { describe, expect, it } from "vitest";
import { rescaleMinor, sanitizeAmountInput, splitByPercentages } from "@/lib/math-engine";
import { applyTemplateToTotal, TEMPLATES } from "@/lib/templates";
import { addMonths, monthDiff } from "@/lib/month-utils";

describe("templates add up exactly", () => {
  it("$1,234.55 on 50/30/20 is balanced (was over by $0.01)", () => {
    const cats = applyTemplateToTotal(TEMPLATES[0], 123455);
    expect(cats.reduce((s, c) => s + c.allocatedCents, 0)).toBe(123455);
  });

  it("holds for every template and many totals", () => {
    for (const t of TEMPLATES.filter((x) => x.categories.length)) {
      for (let total = 0; total < 5000; total += 7) {
        const sum = applyTemplateToTotal(t, total).reduce((s, c) => s + c.allocatedCents, 0);
        expect(sum).toBe(total);
      }
    }
  });

  it("splitByPercentages", () => {
    expect(splitByPercentages(1, [50, 30, 20])).toEqual([1, 0, 0]);
  });
});

describe("currency switch", () => {
  it("relabels without multiplying by 100", () => {
    expect(rescaleMinor(500000, 100, 1)).toBe(5000); // $5,000.00 → ¥5,000
    expect(rescaleMinor(5000, 1, 100)).toBe(500000); // ¥5,000 → $5,000.00
    expect(rescaleMinor(1055, 100, 1)).toBe(11); // $10.55 → ¥11
  });
});

describe("amount input", () => {
  it("drops letters, signs and extra dots", () => {
    expect(sanitizeAmountInput("-300abc", 2)).toBe("300");
    expect(sanitizeAmountInput("1,234.567", 2)).toBe("1234.56");
    expect(sanitizeAmountInput("1.2.3", 2)).toBe("1.23");
    expect(sanitizeAmountInput("99.5", 0)).toBe("99");
  });
});

describe("month utils", () => {
  it("adds and diffs months across years", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -2)).toBe("2026-11");
    expect(monthDiff("2026-12", "2028-05")).toBe(17);
  });
});

describe("auto-split with goals", () => {
  it("keeps must-haves, then goals, then shares the rest", async () => {
    const { splitAfterGoals } = await import("@/lib/templates");
    const cats = applyTemplateToTotal(TEMPLATES[0], 0); // Needs (must-have) 50, Wants 30, Savings 20
    const out = splitAfterGoals(cats, 235000, 72500);
    expect(out.map((c) => c.allocatedCents)).toEqual([117500, 27000, 18000]);
    expect(out.reduce((s, c) => s + c.allocatedCents, 0) + 72500).toBe(235000);
  });

  it("never gives the others less than zero", async () => {
    const { splitAfterGoals } = await import("@/lib/templates");
    const out = splitAfterGoals(applyTemplateToTotal(TEMPLATES[0], 0), 100000, 999999);
    expect(out.map((c) => c.allocatedCents)).toEqual([50000, 0, 0]);
  });
});
