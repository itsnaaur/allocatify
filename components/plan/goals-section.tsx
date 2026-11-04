"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore, type GoalInput } from "@/store/planner-store";
import { useMonthPlan } from "@/lib/use-month-plan";
import type { Goal, GoalPlan, GoalPriority } from "@/lib/finance";
import { formatCents } from "@/lib/math-engine";
import { addMonths, formatMonthKey } from "@/lib/month-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Pencil, PiggyBank, Plus, Trash2, Undo2 } from "lucide-react";
import { Field, MoneyField, centsToMoney, moneyToCents, selectClass } from "./fields";

const PRIORITY_LABEL: Record<GoalPriority, string> = { 1: "Low", 2: "Normal", 3: "High" };

export function GoalsSection() {
  const currency = useBudgetStore((s) => s.currency);
  const { goals, deleteGoal } = usePlannerStore();
  const { monthKey, goalPlans, plan } = useMonthPlan();
  const [editing, setEditing] = React.useState<Goal | "new" | null>(null);
  const [recording, setRecording] = React.useState<{ goal: Goal; plan: GoalPlan } | null>(null);
  const [deleting, setDeleting] = React.useState<Goal | null>(null);

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-semibold">Savings goals</h3>
          <p className="text-sm text-muted-foreground">
            {plan.incomeCents > 0 ? (
              <>
                {formatCents(plan.freeToSaveCents, currency)} free to save this month, after loans,
                bills, must-haves and your {plan.bufferPercent}% safety buffer
              </>
            ) : (
              <>Add your monthly income to see how much you can save</>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" />
          Add goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Saving for something? Add a goal (a laptop, a trip, an emergency fund) and see how
            many months it will take.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((goal) => {
            const gp = goalPlans.find((p) => p.goalId === goal.id);
            if (!gp) return null;
            const pct = goal.targetCents
              ? Math.min(100, (gp.savedCents / goal.targetCents) * 100)
              : 0;
            return (
              <Card key={goal.id}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-muted p-2 shrink-0" aria-hidden>
                      <PiggyBank className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{goal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCents(gp.savedCents, currency)} of{" "}
                        {formatCents(goal.targetCents, currency)}
                        {goal.priority !== 2 && <> · {PRIORITY_LABEL[goal.priority]} priority</>}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => setEditing(goal)}
                        aria-label={`Edit ${goal.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleting(goal)}
                        aria-label={`Delete ${goal.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Progress value={pct} className="h-2" />

                  <GoalStatus goal={goal} gp={gp} />

                  <CarriedIntoGoal goalId={goal.id} />

                  {gp.remainingBeforeMonthCents > 0 && (
                    <div className="flex items-center justify-between gap-2 border-t pt-3">
                      <p className="text-sm">
                        {gp.savedThisMonthCents !== null ? (
                          <>
                            Saved{" "}
                            <span className="font-semibold">
                              {formatCents(gp.savedThisMonthCents, currency)}
                            </span>{" "}
                            this month
                          </>
                        ) : gp.suggestedCents > 0 ? (
                          <>
                            Save{" "}
                            <span className="font-semibold">
                              {formatCents(gp.suggestedCents, currency)}
                            </span>{" "}
                            this month
                          </>
                        ) : (
                          <span className="text-muted-foreground">No room to save this month</span>
                        )}
                      </p>
                      {gp.savedThisMonthCents !== null ? (
                        <UndoSaving goalId={goal.id} monthKey={monthKey} name={goal.name} />
                      ) : (
                        <Button size="sm" onClick={() => setRecording({ goal, plan: gp })}>
                          <Check className="h-4 w-4" />
                          Saved
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <GoalDialog
        key={`goal-${editing === "new" ? "new" : editing?.id ?? "closed"}`}
        editing={editing}
        monthKey={monthKey}
        onClose={() => setEditing(null)}
      />

      <RecordSavingDialog
        key={`saving-${recording?.goal.id ?? "closed"}`}
        recording={recording}
        monthKey={monthKey}
        onClose={() => setRecording(null)}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <p className="text-sm text-muted-foreground">
              This removes the goal and everything you&apos;ve recorded saving for it.
            </p>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) deleteGoal(deleting.id);
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function GoalStatus({ goal, gp }: { goal: Goal; gp: GoalPlan }) {
  const currency = useBudgetStore((s) => s.currency);
  if (gp.isComplete) {
    return <p className="text-sm font-medium text-green-600 dark:text-green-400">You can afford it 🎉</p>;
  }
  return (
    <div className="space-y-1 text-sm">
      {gp.monthsToAfford ? (
        <p>
          Affordable in{" "}
          <span className="font-semibold">
            {gp.monthsToAfford} {gp.monthsToAfford === 1 ? "month" : "months"}
          </span>
          {gp.affordMonthKey && (
            <span className="text-muted-foreground"> · {formatMonthKey(gp.affordMonthKey)}</span>
          )}
        </p>
      ) : (
        gp.remainingBeforeMonthCents > 0 && (
          <p className="text-muted-foreground">
            Nothing free to save right now. Lower other spending or raise income to make progress.
          </p>
        )
      )}
      {gp.deadline && goal.deadlineMonthKey && (
        <p className={gp.deadline.feasible ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}>
          {gp.deadline.monthsAvailable <= 0
            ? `The target date (${formatMonthKey(goal.deadlineMonthKey)}) has passed.`
            : gp.deadline.feasible
              ? `On track for ${formatMonthKey(goal.deadlineMonthKey)}.`
              : `By ${formatMonthKey(goal.deadlineMonthKey)} you'd need ${formatCents(
                  gp.deadline.requiredMonthlyCents,
                  currency
                )}/month — more than you have free.${
                  gp.affordMonthKey ? ` Earliest realistic: ${formatMonthKey(gp.affordMonthKey)}.` : ""
                }`}
        </p>
      )}
    </div>
  );
}

/** "Includes $800 moved from October · Undo" for leftovers put into this goal. */
function CarriedIntoGoal({ goalId }: { goalId: string }) {
  const currency = useBudgetStore((s) => s.currency);
  const reopenLeftover = useBudgetStore((s) => s.reopenLeftover);
  const contributions = usePlannerStore((s) => s.contributions);
  const removeCarrySaving = usePlannerStore((s) => s.removeCarrySaving);
  const carried = contributions.filter((c) => c.goalId === goalId && c.id.endsWith("_carry"));
  if (carried.length === 0) return null;
  return (
    <div className="space-y-1">
      {carried.map((c) => (
        <p key={c.id} className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          Includes {formatCents(c.amountCents, currency)} left over from {formatMonthKey(c.monthKey)}.
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={async () => {
              await removeCarrySaving(goalId, c.monthKey);
              await reopenLeftover(c.monthKey);
            }}
          >
            Undo
          </button>
        </p>
      ))}
    </div>
  );
}

function UndoSaving({ goalId, monthKey, name }: { goalId: string; monthKey: string; name: string }) {
  const removeSaving = usePlannerStore((s) => s.removeSaving);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => removeSaving(goalId, monthKey)}
      aria-label={`Undo this month's saving for ${name}`}
    >
      <Undo2 className="h-4 w-4" />
      Undo
    </Button>
  );
}

function RecordSavingDialog({
  recording,
  monthKey,
  onClose,
}: {
  recording: { goal: Goal; plan: GoalPlan } | null;
  monthKey: string;
  onClose: () => void;
}) {
  const currency = useBudgetStore((s) => s.currency);
  const recordSaving = usePlannerStore((s) => s.recordSaving);
  const suggested = recording
    ? Math.min(recording.plan.suggestedCents || recording.plan.remainingBeforeMonthCents, recording.plan.remainingBeforeMonthCents)
    : 0;
  const [amount, setAmount] = React.useState(centsToMoney(suggested, currency));
  const [error, setError] = React.useState<string>();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recording) return;
    const cents = moneyToCents(amount, currency);
    if (cents <= 0) {
      setError("Enter how much you put aside");
      return;
    }
    recordSaving(recording.goal.id, monthKey, cents);
    onClose();
  };

  return (
    <Dialog open={!!recording} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Saved for {recording?.goal.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            How much did you put aside in {formatMonthKey(monthKey)}?
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <MoneyField
            id="saving-amount"
            label="Amount"
            currency={currency}
            value={amount}
            onChange={setAmount}
            error={error}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GoalDialog({
  editing,
  monthKey,
  onClose,
}: {
  editing: Goal | "new" | null;
  monthKey: string;
  onClose: () => void;
}) {
  const currency = useBudgetStore((s) => s.currency);
  const { addGoal, updateGoal } = usePlannerStore();
  const existing = editing && editing !== "new" ? editing : null;

  const [name, setName] = React.useState(existing?.name ?? "");
  const [target, setTarget] = React.useState(centsToMoney(existing?.targetCents, currency));
  const [saved, setSaved] = React.useState(centsToMoney(existing?.startingSavedCents, currency));
  const [deadline, setDeadline] = React.useState(existing?.deadlineMonthKey ?? "");
  const [priority, setPriority] = React.useState<GoalPriority>(existing?.priority ?? 2);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetCents = moneyToCents(target, currency);
    const savedCents = moneyToCents(saved, currency);
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "What are you saving for?";
    if (targetCents <= 0) next.target = "Enter how much it costs";
    if (deadline && !/^\d{4}-\d{2}$/.test(deadline)) next.deadline = "Pick a month";
    setErrors(next);
    if (Object.keys(next).length) return;
    const input: GoalInput = {
      name: name.trim(),
      targetCents,
      startingSavedCents: savedCents,
      deadlineMonthKey: deadline || undefined,
      priority,
    };
    if (existing) updateGoal(existing.id, input);
    else addGoal(input);
    onClose();
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : "Add a savings goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="goal-name" label="What are you saving for?" error={errors.name}>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New laptop"
              autoFocus
            />
          </Field>
          <MoneyField
            id="goal-target"
            label="How much it costs"
            currency={currency}
            value={target}
            onChange={setTarget}
            error={errors.target}
          />
          <MoneyField
            id="goal-saved"
            label="Already saved (optional)"
            currency={currency}
            value={saved}
            onChange={setSaved}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="goal-deadline"
              label="Want it by (optional)"
              error={errors.deadline}
            >
              <Input
                id="goal-deadline"
                type="month"
                min={monthKey}
                max={addMonths(monthKey, 600)}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </Field>
            <Field id="goal-priority" label="Priority" hint="Higher gets more of your free money">
              <select
                id="goal-priority"
                className={selectClass}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as GoalPriority)}
              >
                <option value={3}>High</option>
                <option value={2}>Normal</option>
                <option value={1}>Low</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{existing ? "Save" : "Add goal"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
