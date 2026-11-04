"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore } from "@/store/planner-store";
import { usePreviousMonthLeftover } from "@/lib/use-month-plan";
import { formatCents } from "@/lib/math-engine";
import { formatMonthKey } from "@/lib/month-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRightLeft, PiggyBank } from "lucide-react";
import { selectClass } from "./fields";

/** At the start of a month: "October ended with $420 left — what should happen to it?" */
export function CarryOverBanner() {
  const currency = useBudgetStore((s) => s.currency);
  const budgetName = useBudgetStore((s) => s.budgetName);
  const carryOverToCurrent = useBudgetStore((s) => s.carryOverToCurrent);
  const markLeftoverHandled = useBudgetStore((s) => s.markLeftoverHandled);
  const goals = usePlannerStore((s) => s.goals);
  const recordCarrySaving = usePlannerStore((s) => s.recordCarrySaving);
  const contributions = usePlannerStore((s) => s.contributions);
  const leftover = usePreviousMonthLeftover();
  const [goalId, setGoalId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  if (!leftover) return null;
  const { fromMonthKey, leftoverCents, tracked } = leftover;
  const fromName = formatMonthKey(fromMonthKey);
  const amount = formatCents(leftoverCents, currency);

  // What each goal still needs in total; a goal never receives more than that.
  const needOf = (id: string) => {
    const g = goals.find((x) => x.id === id);
    if (!g) return 0;
    const saved = contributions
      .filter((c) => c.goalId === id)
      .reduce((s, c) => s + c.amountCents, g.startingSavedCents);
    return Math.max(0, g.targetCents - saved);
  };
  const openGoals = goals.filter((g) => needOf(g.id) > 0);
  const toGoal = goalId ? Math.min(leftoverCents, needOf(goalId)) : 0;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6 border-primary/40">
      <CardContent className="space-y-3 py-4">
        <div className="flex gap-3">
          <ArrowRightLeft className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
          <div>
            <p className="font-medium">
              {fromName} ended with {amount} left over
            </p>
            <p className="text-sm text-muted-foreground">
              {tracked
                ? "Based on what you logged, plus planned amounts for categories you didn't track."
                : `You didn't log any spending in ${fromName}, so this assumes you spent what you planned.`}{" "}
              What should happen to it?
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={busy}
            onClick={() => run(() => carryOverToCurrent(fromMonthKey, leftoverCents))}
          >
            Add to {budgetName}
          </Button>
          {openGoals.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                className={`${selectClass} h-9 w-56`}
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                aria-label="Goal to move the leftover into"
              >
                <option value="">Choose a goal…</option>
                {openGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} (needs {formatCents(needOf(g.id), currency)})
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                disabled={busy || !goalId || toGoal <= 0}
                onClick={() =>
                  run(async () => {
                    // Counted as saved in the month the money came from. If the goal needs
                    // less than the leftover, the rest stays here to add or leave.
                    await recordCarrySaving(goalId, fromMonthKey, toGoal);
                    if (toGoal >= leftoverCents) await markLeftoverHandled(fromMonthKey);
                    setGoalId("");
                  })
                }
              >
                <PiggyBank className="h-4 w-4" />
                {toGoal > 0 && toGoal < leftoverCents
                  ? `Put ${formatCents(toGoal, currency)} into goal`
                  : "Put into goal"}
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => run(() => markLeftoverHandled(fromMonthKey))}
          >
            Leave it
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** "Carried over from October +$420 · Undo" line for the month overview. */
export function CarryInLine() {
  const currency = useBudgetStore((s) => s.currency);
  const carryInCents = useBudgetStore((s) => s.carryInCents);
  const carryInFrom = useBudgetStore((s) => s.carryInFrom);
  const undoCarryIn = useBudgetStore((s) => s.undoCarryIn);
  if (!carryInFrom || carryInCents <= 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
      Includes {formatCents(carryInCents, currency)} carried over from{" "}
      {formatMonthKey(carryInFrom)}.
      <button
        type="button"
        onClick={() => undoCarryIn()}
        className="underline underline-offset-2 hover:text-foreground"
      >
        Undo
      </button>
    </p>
  );
}
