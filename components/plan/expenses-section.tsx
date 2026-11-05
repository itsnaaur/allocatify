"use client";

import * as React from "react";
import { create } from "zustand";
import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore, type ExpenseInput } from "@/store/planner-store";
import { spentByCategory, type Expense } from "@/lib/finance";
import { formatCents } from "@/lib/math-engine";
import { daysInMonth, formatMonthKey, getMonthKey } from "@/lib/month-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { Field, MoneyField, centsToMoney, moneyToCents, selectClass } from "./fields";
import { BankImportButton } from "./bank-import-dialog";

/** Lets category cards open the same "Add expense" dialog with their category picked. */
export const useExpenseDialog = create<{
  editing: Expense | { categoryId: string | null } | null;
  openNew: (categoryId?: string | null) => void;
  openEdit: (expense: Expense) => void;
  close: () => void;
}>((set) => ({
  editing: null,
  openNew: (categoryId = null) => set({ editing: { categoryId } }),
  openEdit: (expense) => set({ editing: expense }),
  close: () => set({ editing: null }),
}));

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${SHORT_MONTHS[m - 1]} ${d}`;
}

/** Spending in the month on screen: what's been spent, and a log of expenses. */
export function ExpensesSection() {
  const currency = useBudgetStore((s) => s.currency);
  const monthKey = useBudgetStore((s) => s.monthKey) ?? getMonthKey(new Date());
  const categories = useBudgetStore((s) => s.categories);
  const expenses = usePlannerStore((s) => s.expenses);
  const deleteExpense = usePlannerStore((s) => s.deleteExpense);
  const { openNew, openEdit } = useExpenseDialog();

  const monthExpenses = expenses.filter((e) => e.monthKey === monthKey);
  const spentTotal = monthExpenses.reduce((s, e) => s + e.amountCents, 0);
  const plannedTotal = categories.reduce((s, c) => s + c.allocatedCents, 0);
  const names = new Map(categories.map((c) => [c.id, c]));

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">Spending log</h3>
          <p className="text-sm text-muted-foreground">
            {formatCents(spentTotal, currency)} spent of {formatCents(plannedTotal, currency)} planned
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <BankImportButton />
          <Button variant="outline" className="hidden sm:inline-flex" onClick={() => openNew()}>
            <Plus className="h-4 w-4" />
            Add expense
          </Button>
        </div>
      </div>

      {monthExpenses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Log what you actually spend to see it against your plan. Nothing logged for{" "}
            {formatMonthKey(monthKey)} yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {monthExpenses.map((e) => {
              const cat = e.categoryId ? names.get(e.categoryId) : undefined;
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">
                    {shortDate(e.date)}
                  </span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cat?.color ?? "#6b7280" }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {e.note || cat?.name || "Uncategorized"}
                    </p>
                    {e.note && (
                      <p className="truncate text-xs text-muted-foreground">
                        {cat?.name ?? "Uncategorized"}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-sm">{formatCents(e.amountCents, currency)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => openEdit(e)}
                    aria-label={`Edit expense ${e.note || cat?.name || ""} on ${shortDate(e.date)}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteExpense(e.id)}
                    aria-label={`Delete expense ${e.note || cat?.name || ""} on ${shortDate(e.date)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

    </section>
  );
}

/** Spent so far in one category this month. */
export function useCategorySpent(categoryId: string): number {
  const monthKey = useBudgetStore((s) => s.monthKey) ?? getMonthKey(new Date());
  const expenses = usePlannerStore((s) => s.expenses);
  return React.useMemo(
    () => spentByCategory(expenses, monthKey).get(categoryId) ?? 0,
    [expenses, monthKey, categoryId]
  );
}

function defaultDate(monthKey: string): string {
  const today = new Date();
  if (getMonthKey(today) === monthKey) {
    return `${monthKey}-${String(today.getDate()).padStart(2, "0")}`;
  }
  return `${monthKey}-01`;
}

/** Rendered once at app level so any tab can open it. */
export function ExpenseDialog() {
  const { editing, close } = useExpenseDialog();
  const key = editing
    ? "id" in editing
      ? editing.id
      : `new-${editing.categoryId ?? "none"}`
    : "closed";
  return <ExpenseForm key={key} editing={editing} onClose={close} />;
}

function ExpenseForm({
  editing,
  onClose,
}: {
  editing: Expense | { categoryId: string | null } | null;
  onClose: () => void;
}) {
  const currency = useBudgetStore((s) => s.currency);
  const monthKey = useBudgetStore((s) => s.monthKey) ?? getMonthKey(new Date());
  const categories = useBudgetStore((s) => s.categories);
  const { addExpense, updateExpense } = usePlannerStore();
  const existing = editing && "id" in editing ? editing : null;

  const [amount, setAmount] = React.useState(centsToMoney(existing?.amountCents, currency));
  const [categoryId, setCategoryId] = React.useState<string>(
    existing ? existing.categoryId ?? "" : editing?.categoryId ?? categories[0]?.id ?? ""
  );
  const [date, setDate] = React.useState(existing?.date ?? defaultDate(monthKey));
  const [note, setNote] = React.useState(existing?.note ?? "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const first = `${monthKey}-01`;
  const last = `${monthKey}-${String(daysInMonth(monthKey)).padStart(2, "0")}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = moneyToCents(amount, currency);
    const next: Record<string, string> = {};
    if (cents <= 0) next.amount = "Enter how much you spent";
    if (!date || date < first || date > last)
      next.date = `Pick a day in ${formatMonthKey(monthKey)}`;
    setErrors(next);
    if (Object.keys(next).length) return;
    const input: ExpenseInput = {
      monthKey,
      date,
      amountCents: cents,
      categoryId: categoryId || null,
      note: note.trim() || undefined,
    };
    if (existing) updateExpense(existing.id, input);
    else addExpense(input);
    onClose();
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" aria-hidden />
            {existing ? "Edit expense" : "Add expense"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <MoneyField
            id="exp-amount"
            label="Amount"
            currency={currency}
            value={amount}
            onChange={setAmount}
            error={errors.amount}
          />
          <Field id="exp-category" label="Category">
            <select
              id="exp-category"
              className={selectClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="">Uncategorized</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="exp-date" label="Date" error={errors.date}>
              <Input
                id="exp-date"
                type="date"
                min={first}
                max={last}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field id="exp-note" label="Note (optional)">
              <Input
                id="exp-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Groceries"
                maxLength={80}
              />
            </Field>
          </div>
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
