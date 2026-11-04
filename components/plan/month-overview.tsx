"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore } from "@/store/planner-store";
import { useMonthPlan } from "@/lib/use-month-plan";
import { MAX_BUFFER_PERCENT, MIN_BUFFER_PERCENT } from "@/lib/finance";
import { formatCents } from "@/lib/math-engine";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Where the month's income goes, and whether the safety buffer is protected. */
export function MonthOverview() {
  const currency = useBudgetStore((s) => s.currency);
  const setBufferPercent = usePlannerStore((s) => s.setBufferPercent);
  const { plan, goalSavingsCents, health } = useMonthPlan();

  if (health.kind === "no-income") return null;

  const left =
    plan.incomeCents -
    plan.fixedCents -
    plan.essentialCents -
    plan.otherSpendingCents -
    goalSavingsCents;

  const rows: { label: string; cents: number; sign: "+" | "−" }[] = [
    { label: "Income", cents: plan.incomeCents, sign: "+" },
    { label: "Loans & bills", cents: plan.fixedCents, sign: "−" },
    { label: "Must-haves", cents: plan.essentialCents, sign: "−" },
    { label: "Other spending", cents: plan.otherSpendingCents, sign: "−" },
    { label: "Goal savings", cents: goalSavingsCents, sign: "−" },
  ];

  const tone =
    health.kind === "over-budget"
      ? "border-destructive bg-destructive/5"
      : health.kind === "into-buffer"
        ? "border-amber-500/60 bg-amber-500/5"
        : "border-green-500/50 bg-green-500/5";

  return (
    <Card className={cn("h-full", tone)}>
      <CardContent className="py-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {left < 0 ? "Over budget by" : "Left for you"}
            </p>
            <p
              className={cn(
                "text-2xl font-bold",
                health.kind === "over-budget"
                  ? "text-destructive"
                  : health.kind === "into-buffer"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-green-600 dark:text-green-400"
              )}
            >
              {formatCents(Math.abs(left), currency)}
            </p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm">
            {rows.map((r) => (
              <React.Fragment key={r.label}>
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="text-right font-mono">
                  {r.sign === "−" && r.cents > 0 ? "−" : ""}
                  {formatCents(r.cents, currency)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </div>

        <HealthMessage />

        <div className="space-y-1.5 border-t pt-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <label htmlFor="buffer-range" className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden />
              Safety buffer
            </label>
            <span className="font-mono">
              {plan.bufferPercent}% · {formatCents(plan.bufferCents, currency)}
            </span>
          </div>
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
          <p id="buffer-hint" className="text-xs text-muted-foreground">
            Kept untouched for surprises. Savings suggestions never use it. Minimum{" "}
            {MIN_BUFFER_PERCENT}%, you can raise it up to {MAX_BUFFER_PERCENT}%.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthMessage() {
  const currency = useBudgetStore((s) => s.currency);
  const { health, plan } = useMonthPlan();
  if (health.kind === "over-budget") {
    return (
      <p className="flex gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        You&apos;re planning to spend more than you earn. Cut{" "}
        {formatCents(health.overCents + plan.bufferCents, currency)} to get back to safe (including
        your buffer).
      </p>
    );
  }
  if (health.kind === "into-buffer") {
    return (
      <p className="flex gap-2 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        This plan dips {formatCents(health.shortCents, currency)} into your safety buffer. Lower
        other spending or a goal&apos;s saving this month.
      </p>
    );
  }
  if (health.kind === "ok") {
    return (
      <p className="flex gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600 dark:text-green-400" aria-hidden />
        Balanced. Your {plan.bufferPercent}% safety buffer is protected.
      </p>
    );
  }
  return null;
}
