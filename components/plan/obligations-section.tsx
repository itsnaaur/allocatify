"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore, type ObligationInput } from "@/store/planner-store";
import { useMonthPlan } from "@/lib/use-month-plan";
import {
  dueDateInMonth,
  dueStatus,
  loanSummary,
  type DueStatus,
  type Obligation,
  type ObligationKind,
} from "@/lib/finance";
import { formatCents } from "@/lib/math-engine";
import { formatMonthKey } from "@/lib/month-utils";
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
import { Check, Landmark, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, MoneyField, centsToMoney, moneyToCents, selectClass } from "./fields";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function StatusBadge({ status }: { status: DueStatus }) {
  const map: Record<DueStatus["kind"], { text: string; className: string }> = {
    paid: { text: "Paid", className: "bg-green-500/15 text-green-600 dark:text-green-400" },
    overdue: {
      text: status.kind === "overdue" ? `Overdue ${status.days}d` : "",
      className: "bg-destructive/15 text-destructive",
    },
    "due-today": { text: "Due today", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    "due-soon": {
      text: status.kind === "due-soon" ? `Due in ${status.days}d` : "",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    upcoming: { text: "Upcoming", className: "bg-muted text-muted-foreground" },
  };
  const { text, className } = map[status.kind];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>
      {text}
    </span>
  );
}

export function ObligationsSection() {
  const currency = useBudgetStore((s) => s.currency);
  const { payments, markPaid, unmarkPaid, deleteObligation, obligations } = usePlannerStore();
  const { monthKey, dueItems, plan } = useMonthPlan();
  const [editing, setEditing] = React.useState<Obligation | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Obligation | null>(null);
  const today = new Date();

  const sorted = [...dueItems].sort((a, b) => a.obligation.dueDay - b.obligation.dueDay);
  // Loans already paid off, or loans/bills that start in a later month.
  const notDueThisMonth = obligations.filter(
    (o) => !dueItems.some((d) => d.obligation.id === o.id)
  );

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-semibold">Loans &amp; bills</h3>
          <p className="text-sm text-muted-foreground">
            Added to every month automatically ·{" "}
            {formatCents(plan.fixedCents, currency)} due in {formatMonthKey(monthKey)}
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" />
          Add loan or bill
        </Button>
      </div>

      {sorted.length === 0 && notDueThisMonth.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No loans or bills yet. Add a loan to see how many months are left, or a bill like
            rent so it&apos;s counted every month.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sorted.map(({ obligation: ob, dueCents, payment }) => {
            const status = dueStatus(ob.dueDay, monthKey, !!payment, today);
            const due = dueDateInMonth(ob.dueDay, monthKey);
            const loan = ob.kind === "loan" ? loanSummary(ob, payments) : null;
            const paidPct =
              loan && ob.totalOwedCents
                ? Math.min(100, (loan.paidCents / ob.totalOwedCents) * 100)
                : 0;
            return (
              <Card key={ob.id}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-lg bg-muted p-2 shrink-0" aria-hidden>
                      {ob.kind === "loan" ? (
                        <Landmark className="h-4 w-4" />
                      ) : (
                        <Receipt className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 basis-32">
                      <p className="font-medium truncate">{ob.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ob.kind === "loan" ? "Loan" : "Bill"} · due {SHORT_MONTHS[due.getMonth()]}{" "}
                        {due.getDate()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold">{formatCents(dueCents, currency)}</p>
                      <StatusBadge status={status} />
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={payment ? "outline" : "default"}
                        onClick={() =>
                          payment ? unmarkPaid(ob.id, monthKey) : markPaid(ob.id, monthKey, dueCents)
                        }
                        aria-pressed={!!payment}
                        aria-label={payment ? `Undo paid for ${ob.name}` : `Mark ${ob.name} as paid`}
                      >
                        <Check className="h-4 w-4" />
                        {payment ? "Paid" : "Mark paid"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => setEditing(ob)}
                        aria-label={`Edit ${ob.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleting(ob)}
                        aria-label={`Delete ${ob.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {loan && (
                    <div className="space-y-1">
                      <Progress value={paidPct} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">
                        {loan.isPaidOff ? (
                          <>Paid off 🎉</>
                        ) : (
                          <>
                            <span className="font-medium text-foreground">
                              {loan.monthsLeft} {loan.monthsLeft === 1 ? "month" : "months"} left
                            </span>{" "}
                            · {formatCents(loan.remainingCents, currency)} to go · paid off{" "}
                            {loan.payoffMonthKey && formatMonthKey(loan.payoffMonthKey)}
                            {loan.finalPaymentCents !== ob.monthlyCents && loan.monthsLeft > 1 && (
                              <> · last payment {formatCents(loan.finalPaymentCents, currency)}</>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {notDueThisMonth.map((ob) => {
            const loan = ob.kind === "loan" ? loanSummary(ob, payments) : null;
            return (
              <Card key={ob.id} className="opacity-70">
                <CardContent className="py-3 flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">{ob.name}</span> ·{" "}
                    {loan?.isPaidOff
                      ? "paid off 🎉"
                      : `starts ${formatMonthKey(ob.startMonthKey)}`}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => setEditing(ob)}
                      aria-label={`Edit ${ob.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(ob)}
                      aria-label={`Delete ${ob.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ObligationDialog
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        editing={editing}
        monthKey={monthKey}
        onClose={() => setEditing(null)}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <p className="text-sm text-muted-foreground">
              This removes it from every month, including its payment history.
            </p>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) deleteObligation(deleting.id);
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

function ObligationDialog({
  editing,
  monthKey,
  onClose,
}: {
  editing: Obligation | "new" | null;
  monthKey: string;
  onClose: () => void;
}) {
  const currency = useBudgetStore((s) => s.currency);
  const { addObligation, updateObligation } = usePlannerStore();
  const existing = editing && editing !== "new" ? editing : null;

  const [kind, setKind] = React.useState<ObligationKind>(existing?.kind ?? "loan");
  const [name, setName] = React.useState(existing?.name ?? "");
  const [monthly, setMonthly] = React.useState(centsToMoney(existing?.monthlyCents, currency));
  const [total, setTotal] = React.useState(centsToMoney(existing?.totalOwedCents, currency));
  const [dueDay, setDueDay] = React.useState(existing?.dueDay ?? 1);
  const [start, setStart] = React.useState(existing?.startMonthKey ?? monthKey);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const monthlyCents = moneyToCents(monthly, currency);
  const totalCents = moneyToCents(total, currency);
  const preview =
    kind === "loan" && monthlyCents > 0 && totalCents > 0
      ? loanSummary(
          {
            id: "preview",
            kind,
            name,
            monthlyCents,
            dueDay,
            startMonthKey: start,
            totalOwedCents: totalCents,
            createdAt: 0,
          },
          []
        )
      : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Give it a name, e.g. Car loan or Rent";
    if (monthlyCents <= 0) next.monthly = "Enter the monthly payment";
    if (kind === "loan" && totalCents <= 0) next.total = "Enter the total you still have to pay";
    if (!/^\d{4}-\d{2}$/.test(start)) next.start = "Pick the month of the first payment";
    setErrors(next);
    if (Object.keys(next).length) return;
    const input: ObligationInput = {
      kind,
      name: name.trim(),
      monthlyCents,
      dueDay,
      startMonthKey: start,
      totalOwedCents: kind === "loan" ? totalCents : undefined,
    };
    if (existing) updateObligation(existing.id, input);
    else addObligation(input);
    onClose();
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : "Add a loan or bill"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type">
            {(["loan", "bill"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm",
                  kind === k ? "border-primary bg-accent" : "border-input"
                )}
              >
                <span className="font-medium">{k === "loan" ? "Loan" : "Bill"}</span>
                <span className="block text-xs text-muted-foreground">
                  {k === "loan" ? "Ends once it's paid off" : "Every month, e.g. rent"}
                </span>
              </button>
            ))}
          </div>

          <Field id="ob-name" label="Name" error={errors.name}>
            <Input
              id="ob-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "loan" ? "Car loan" : "Rent"}
              autoFocus
            />
          </Field>

          {kind === "loan" && (
            <MoneyField
              id="ob-total"
              label={existing ? "Total to pay (when you added it)" : "Total left to pay"}
              hint="Include interest — the full amount you still owe."
              currency={currency}
              value={total}
              onChange={setTotal}
              error={errors.total}
            />
          )}

          <MoneyField
            id="ob-monthly"
            label="Monthly payment"
            currency={currency}
            value={monthly}
            onChange={setMonthly}
            error={errors.monthly}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field id="ob-day" label="Due day">
              <select
                id="ob-day"
                className={selectClass}
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                    {d >= 29 ? " (or last day)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ob-start" label="First payment" error={errors.start}>
              <Input
                id="ob-start"
                type="month"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
          </div>

          {preview && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">
              {preview.monthsLeft} {preview.monthsLeft === 1 ? "payment" : "payments"} · paid off{" "}
              <span className="font-medium">
                {preview.payoffMonthKey && formatMonthKey(preview.payoffMonthKey)}
              </span>
              {preview.finalPaymentCents !== monthlyCents && (
                <> · last payment {formatCents(preview.finalPaymentCents, currency)}</>
              )}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{existing ? "Save" : "Add"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
