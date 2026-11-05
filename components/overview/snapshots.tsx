"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore } from "@/store/planner-store";
import { useNav, type Tab } from "@/store/nav-store";
import { useMonthPlan } from "@/lib/use-month-plan";
import { dueDateInMonth, dueStatus, spentByCategory } from "@/lib/finance";
import { formatCents } from "@/lib/math-engine";
import { formatMonthKey } from "@/lib/month-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useExpenseDialog } from "@/components/plan/expenses-section";
import { ArrowRight, Check, CheckCircle2, Circle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function GoTo({ tab, children }: { tab: Tab; children: React.ReactNode }) {
  const setTab = useNav((s) => s.setTab);
  return (
    <Button variant="ghost" size="sm" className="-mr-2 h-8 text-xs" onClick={() => setTab(tab)}>
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </Button>
  );
}

function SnapshotCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** First visit: the few steps that make the app useful. */
export function GetStartedCard() {
  const totalCents = useBudgetStore((s) => s.totalCents);
  const { obligations, goals, expenses } = usePlannerStore();
  const setTab = useNav((s) => s.setTab);
  if (totalCents > 0 && (obligations.length > 0 || goals.length > 0 || expenses.length > 0)) return null;
  const steps: { done: boolean; label: string; hint: string; tab: Tab }[] = [
    { done: totalCents > 0, label: "Add your monthly income", hint: "Salary and any side income", tab: "plan" },
    { done: obligations.length > 0, label: "Add loans and bills", hint: "Rent, subscriptions, loans with months left", tab: "plan" },
    { done: goals.length > 0, label: "Save for something", hint: "See how many months it takes", tab: "goals" },
    { done: expenses.length > 0, label: "Log or import spending", hint: "Track it against your plan", tab: "spending" },
  ];
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Get started</CardTitle>
        <p className="text-sm text-muted-foreground">
          Four steps to a full monthly plan. Everything stays on this device.
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {steps.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setTab(s.tab)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent"
          >
            {s.done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" aria-label="Done" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-label="To do" />
            )}
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-medium", s.done && "text-muted-foreground line-through")}>
                {s.label}
              </span>
              <span className="block text-xs text-muted-foreground">{s.hint}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

/** Loans and bills still to pay this month, soonest first. */
export function UpcomingPayments() {
  const currency = useBudgetStore((s) => s.currency);
  const markPaid = usePlannerStore((s) => s.markPaid);
  const { monthKey, dueItems } = useMonthPlan();
  const today = new Date();
  const unpaid = dueItems
    .filter((d) => !d.payment)
    .sort((a, b) => a.obligation.dueDay - b.obligation.dueDay);
  const paidCount = dueItems.length - unpaid.length;

  return (
    <SnapshotCard title="Coming up" action={<GoTo tab="plan">Loans &amp; bills</GoTo>}>
      {dueItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No loans or bills this month.</p>
      ) : unpaid.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          All {dueItems.length} paid for {formatMonthKey(monthKey)}
        </p>
      ) : (
        <ul className="divide-y">
          {unpaid.slice(0, 5).map(({ obligation: ob, dueCents }) => {
            const status = dueStatus(ob.dueDay, monthKey, false, today);
            const due = dueDateInMonth(ob.dueDay, monthKey);
            const when =
              status.kind === "overdue"
                ? `Overdue ${status.days}d`
                : status.kind === "due-today"
                  ? "Due today"
                  : `${SHORT[due.getMonth()]} ${due.getDate()}`;
            return (
              <li key={ob.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ob.name}</p>
                  <p
                    className={cn(
                      "text-xs",
                      status.kind === "overdue"
                        ? "text-destructive"
                        : status.kind === "due-today" || status.kind === "due-soon"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {when}
                  </p>
                </div>
                <span className="font-mono text-sm">{formatCents(dueCents, currency)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => markPaid(ob.id, monthKey, dueCents)}
                  aria-label={`Mark ${ob.name} as paid`}
                >
                  <Check className="h-4 w-4" />
                  Paid
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {paidCount > 0 && unpaid.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{paidCount} already paid this month</p>
      )}
    </SnapshotCard>
  );
}

/** Spent vs planned for each category. */
export function SpendingSnapshot({
  showLink = true,
  title = "Spending",
}: {
  showLink?: boolean;
  title?: string;
}) {
  const currency = useBudgetStore((s) => s.currency);
  const categories = useBudgetStore((s) => s.categories);
  const monthKey = useBudgetStore((s) => s.monthKey);
  const expenses = usePlannerStore((s) => s.expenses);
  const openExpense = useExpenseDialog((s) => s.openNew);
  const spent = React.useMemo(
    () => (monthKey ? spentByCategory(expenses, monthKey) : new Map<string, number>()),
    [expenses, monthKey]
  );
  const totalSpent = [...spent.values()].reduce((s, v) => s + v, 0);
  const totalPlanned = categories.reduce((s, c) => s + c.allocatedCents, 0);

  return (
    <SnapshotCard
      title={title}
      action={showLink ? <GoTo tab="spending">Spending log</GoTo> : undefined}
    >
      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{formatCents(totalSpent, currency)}</span> of{" "}
        {formatCents(totalPlanned, currency)} planned
      </p>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No spending categories yet.</p>
      ) : (
        <ul className="space-y-3">
          {categories.map((c) => {
            const s = spent.get(c.id) ?? 0;
            const over = s > c.allocatedCents;
            const pct = c.allocatedCents > 0 ? Math.min(100, (s / c.allocatedCents) * 100) : s > 0 ? 100 : 0;
            return (
              <li key={c.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color ?? "#6b7280" }} aria-hidden />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className={cn("shrink-0 font-mono text-xs", over ? "text-destructive" : "text-muted-foreground")}>
                    {formatCents(s, currency)} / {formatCents(c.allocatedCents, currency)}
                  </span>
                </div>
                <Progress
                  value={pct}
                  className={cn("h-1.5", over && "[&>div]:bg-destructive")}
                  aria-label={`${c.name}: spent ${formatCents(s, currency)} of ${formatCents(c.allocatedCents, currency)}`}
                />
              </li>
            );
          })}
        </ul>
      )}
      {/* Phones have the floating + button instead. */}
      <Button variant="outline" size="sm" className="mt-4 hidden w-full sm:flex" onClick={() => openExpense()}>
        <Plus className="h-4 w-4" />
        Add expense
      </Button>
    </SnapshotCard>
  );
}

/** Progress on each savings goal. */
export function GoalsSnapshot() {
  const currency = useBudgetStore((s) => s.currency);
  const goals = usePlannerStore((s) => s.goals);
  const { goalPlans } = useMonthPlan();
  return (
    <SnapshotCard title="Goals" action={<GoTo tab="goals">All goals</GoTo>}>
      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No goals yet. Add one to see how many months it takes to afford it.
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const gp = goalPlans.find((p) => p.goalId === g.id);
            if (!gp) return null;
            const pct = g.targetCents ? Math.min(100, (gp.savedCents / g.targetCents) * 100) : 0;
            return (
              <li key={g.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{g.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {gp.isComplete
                      ? "Ready 🎉"
                      : gp.monthsToAfford
                        ? `${gp.monthsToAfford} ${gp.monthsToAfford === 1 ? "month" : "months"} to go`
                        : "No room this month"}
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCents(gp.savedCents, currency)} of {formatCents(g.targetCents, currency)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </SnapshotCard>
  );
}
