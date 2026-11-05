"use client";

import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore } from "@/store/planner-store";
import { useMonthPlan } from "@/lib/use-month-plan";
import { MAX_BUFFER_PERCENT, MIN_BUFFER_PERCENT } from "@/lib/finance";
import { formatCents } from "@/lib/math-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

/** The safety buffer: a share of income kept aside, never below 10%. */
export function SafetyBufferCard() {
  const currency = useBudgetStore((s) => s.currency);
  const setBufferPercent = usePlannerStore((s) => s.setBufferPercent);
  const { plan } = useMonthPlan();
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden />
          <label htmlFor="buffer-range">Safety buffer</label>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Kept untouched for surprises. Savings suggestions never use it.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-2xl font-semibold">
          {plan.bufferPercent}%{" "}
          <span className="text-base font-normal text-muted-foreground">
            · {formatCents(plan.bufferCents, currency)} this month
          </span>
        </p>
        <input
          id="buffer-range"
          type="range"
          min={MIN_BUFFER_PERCENT}
          max={MAX_BUFFER_PERCENT}
          step={5}
          value={plan.bufferPercent}
          onChange={(e) => setBufferPercent(Number(e.target.value))}
          className="w-full accent-green-600"
          aria-describedby="buffer-hint"
        />
        <p id="buffer-hint" className="flex justify-between text-xs text-muted-foreground">
          <span>Minimum {MIN_BUFFER_PERCENT}%</span>
          <span>Up to {MAX_BUFFER_PERCENT}%</span>
        </p>
      </CardContent>
    </Card>
  );
}
