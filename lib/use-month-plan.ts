"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore } from "@/store/planner-store";
import {
  buildMonthPlan,
  monthHealth,
  obligationDueInMonth,
  planGoals,
} from "@/lib/finance";
import { getMonthKey } from "@/lib/month-utils";

/** Everything needed to show the selected month: due payments, goal suggestions, totals. */
export function useMonthPlan() {
  const totalCents = useBudgetStore((s) => s.totalCents);
  const categories = useBudgetStore((s) => s.categories);
  const storeMonthKey = useBudgetStore((s) => s.monthKey);
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
      fixedCents,
      essentialCents,
      otherSpendingCents,
      bufferPercent,
    });

    const goalPlans = planGoals(goals, contributions, plan.freeToSaveCents, monthKey);
    const goalSavingsCents = goalPlans.reduce((s, g) => s + g.plannedCents, 0);
    const health = monthHealth(plan, goalSavingsCents);

    return { monthKey, dueItems, plan, goalPlans, goalSavingsCents, health };
  }, [obligations, payments, goals, contributions, bufferPercent, categories, totalCents, monthKey]);
}
