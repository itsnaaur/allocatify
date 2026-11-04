"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore } from "@/store/planner-store";
import {
  buildMonthPlan,
  monthHealth,
  monthLeftover,
  obligationDueInMonth,
  planGoals,
  spentByCategory,
} from "@/lib/finance";
import { addMonths, getMonthKey, monthDiff } from "@/lib/month-utils";

/** Everything needed to show the selected month: due payments, goal suggestions, totals. */
export function useMonthPlan() {
  const totalCents = useBudgetStore((s) => s.totalCents);
  const categories = useBudgetStore((s) => s.categories);
  const storeMonthKey = useBudgetStore((s) => s.monthKey);
  const carryInCents = useBudgetStore((s) => s.carryInCents);
  const { obligations, payments, goals, contributions, bufferPercent } = usePlannerStore();

  const monthKey = storeMonthKey ?? getMonthKey(new Date());

  return React.useMemo(() => {
    const dueItems = obligations
      .map((ob) => {
        const payment = payments.find(
          (p) => p.obligationId === ob.id && p.monthKey === monthKey
        );
        const due = obligationDueInMonth(ob, monthKey, payments);
        return { obligation: ob, dueCents: payment?.amountCents ?? due, payment };
      })
      .filter((x) => x.dueCents > 0 || x.payment);

    const fixedCents = dueItems.reduce((s, x) => s + x.dueCents, 0);
    const essentialCents = categories
      .filter((c) => c.essential)
      .reduce((s, c) => s + c.allocatedCents, 0);
    const otherSpendingCents = categories
      .filter((c) => !c.essential)
      .reduce((s, c) => s + c.allocatedCents, 0);

    const plan = buildMonthPlan({
      incomeCents: totalCents,
      carryInCents,
      fixedCents,
      essentialCents,
      otherSpendingCents,
      bufferPercent,
    });

    const goalPlans = planGoals(goals, contributions, plan.freeToSaveCents, monthKey);
    const goalSavingsCents = goalPlans.reduce((s, g) => s + g.plannedCents, 0);
    const health = monthHealth(plan, goalSavingsCents);

    return { monthKey, dueItems, plan, goalPlans, goalSavingsCents, health };
  }, [obligations, payments, goals, contributions, bufferPercent, categories, totalCents, carryInCents, monthKey]);
}

/**
 * Money left over from the month before the one on screen, if that month is over and
 * its leftover hasn't been dealt with yet. Null when there's nothing to offer.
 */
export function usePreviousMonthLeftover() {
  const storeMonthKey = useBudgetStore((s) => s.monthKey);
  const monthlyBudgets = useBudgetStore((s) => s.monthlyBudgets);
  const { obligations, payments, contributions, expenses } = usePlannerStore();
  const monthKey = storeMonthKey ?? getMonthKey(new Date());

  return React.useMemo(() => {
    const prevKey = addMonths(monthKey, -1);
    const prev = monthlyBudgets.find((b) => (b.monthKey ?? b.id) === prevKey);
    if (!prev || prev.carryOutHandled) return null;
    // Only once that month is actually over.
    if (monthDiff(prevKey, getMonthKey(new Date())) < 1) return null;

    const fixedCents = obligations.reduce((sum, ob) => {
      const paid = payments.find((p) => p.obligationId === ob.id && p.monthKey === prevKey);
      return sum + (paid?.amountCents ?? obligationDueInMonth(ob, prevKey, payments));
    }, 0);
    const goalSavedCents = contributions
      .filter((c) => c.monthKey === prevKey)
      .reduce((s, c) => s + c.amountCents, 0);

    const leftoverCents = monthLeftover({
      incomeCents: prev.totalCents,
      carryInCents: prev.carryInCents ?? 0,
      fixedCents,
      categories: prev.categories,
      spent: spentByCategory(expenses, prevKey),
      goalSavedCents,
      carriedOutCents: prev.carryOutCents ?? 0,
    });
    if (leftoverCents <= 0) return null;
    return {
      fromMonthKey: prevKey,
      leftoverCents,
      tracked: expenses.some((e) => e.monthKey === prevKey),
    };
  }, [monthKey, monthlyBudgets, obligations, payments, contributions, expenses]);
}
