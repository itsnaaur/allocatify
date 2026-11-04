"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { useMonthPlan } from "@/lib/use-month-plan";

/**
 * Keeps template categories split over what's actually left to spend:
 * income − loans & bills − safety buffer. Stops once the user edits an amount.
 */
export function AutoSplit() {
  const autoScale = useBudgetStore((s) => s.autoScale);
  const autoSplit = useBudgetStore((s) => s.autoSplit);
  const { plan, goalSavingsCents } = useMonthPlan();
  const spendable = plan.incomeCents - plan.fixedCents - plan.bufferCents;

  React.useEffect(() => {
    if (autoScale) autoSplit(spendable, goalSavingsCents);
  }, [autoScale, autoSplit, spendable, goalSavingsCents]);

  return null;
}

/** "Split automatically…" note shown above the categories while auto-split is on. */
export function AutoSplitNote() {
  const autoScale = useBudgetStore((s) => s.autoScale);
  const templateId = useBudgetStore((s) => s.activeTemplateId);
  if (!autoScale || !templateId) return null;
  return (
    <>
      Split automatically: must-haves first, then your goals, and the rest share what&apos;s
      left. Edit any amount to set your own.
    </>
  );
}
