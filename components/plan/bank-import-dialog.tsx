"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore } from "@/store/planner-store";
import {
  guessColumns,
  guessDateOrder,
  guessSignMode,
  MAX_IMPORT_BYTES,
  planImport,
  readBankCsv,
  type BankTable,
  type ColumnGuess,
  type DateOrder,
  type SignMode,
} from "@/lib/bank-import";
import { CURRENCIES } from "@/lib/currencies";
import { formatCents } from "@/lib/math-engine";
import { formatMonthKey } from "@/lib/month-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, FileUp } from "lucide-react";
import { Field, selectClass } from "./fields";

/** "Import from bank" button + dialog: pick a statement CSV, check the guesses, import. */
export function BankImportButton() {
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [table, setTable] = React.useState<BankTable | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setError("This file is too large. Export a shorter date range from your bank.");
      setFileName(file.name);
      return;
    }
    const result = readBankCsv(await file.text());
    setFileName(file.name);
    if ("error" in result) setError(result.error);
    else setTable(result);
  };

  return (
    <>
      <Button variant="outline" onClick={() => fileInput.current?.click()}>
        <FileUp className="h-4 w-4" />
        Import from bank
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv,.txt"
        className="hidden"
        onChange={onFile}
        aria-hidden
        tabIndex={-1}
      />
      {table && (
        <ImportDialog table={table} fileName={fileName} onClose={() => setTable(null)} />
      )}
      <Dialog open={!!error} onOpenChange={(o) => !o && setError(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Couldn&apos;t read {fileName || "that file"}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {error} Nothing was imported. Most banks offer a CSV download under statements or
              transaction history.
            </p>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={() => setError(null)}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ImportDialog({
  table,
  fileName,
  onClose,
}: {
  table: BankTable;
  fileName: string;
  onClose: () => void;
}) {
  const currency = useBudgetStore((s) => s.currency);
  const categories = useBudgetStore((s) => s.categories);
  const monthlyBudgets = useBudgetStore((s) => s.monthlyBudgets);
  const expenses = usePlannerStore((s) => s.expenses);
  const addExpenses = usePlannerStore((s) => s.addExpenses);

  const initial = React.useMemo(() => guessColumns(table), [table]);
  const [columns, setColumns] = React.useState<ColumnGuess>(initial);
  const dateGuess = React.useMemo(
    () => guessDateOrder(table.rows.map((r) => r[columns.date] ?? "")),
    [table, columns.date]
  );
  const [dateOrder, setDateOrder] = React.useState<DateOrder>(dateGuess.order);
  const [signMode, setSignMode] = React.useState<SignMode>(() =>
    guessSignMode(table, initial.amount)
  );
  const [categoryId, setCategoryId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const plan = React.useMemo(
    () =>
      planImport(table, {
        columns,
        dateOrder,
        signMode,
        minorUnitsPerMajor: CURRENCIES[currency].minorUnitsPerMajor,
        existing: expenses,
      }),
    [table, columns, dateOrder, signMode, currency, expenses]
  );

  const toImport = plan.rows.filter((r) => !r.duplicate);
  const duplicates = plan.rows.length - toImport.length;
  const total = toImport.reduce((s, r) => s + r.amountCents, 0);
  const months = [...new Set(toImport.map((r) => r.monthKey))].sort();
  const savedMonths = new Set(monthlyBudgets.map((b) => b.monthKey ?? b.id));
  const unsavedMonths = months.filter((m) => !savedMonths.has(m));

  const columnSelect = (key: keyof ColumnGuess, label: string, optional = false) => (
    <Field id={`col-${key}`} label={label}>
      <select
        id={`col-${key}`}
        className={selectClass}
        value={columns[key]}
        onChange={(e) => setColumns({ ...columns, [key]: Number(e.target.value) })}
      >
        {optional && <option value={-1}>None</option>}
        {table.headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </Field>
  );

  const doImport = async () => {
    setBusy(true);
    await addExpenses(
      toImport.map((r) => ({
        monthKey: r.monthKey,
        date: r.date,
        amountCents: r.amountCents,
        categoryId: categoryId || null,
        note: r.description || undefined,
      }))
    );
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import spending from {fileName}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            The file stays on your device. Check the columns below, then import.
          </p>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          {columnSelect("date", "Date column")}
          {columnSelect("amount", "Amount column")}
          {columnSelect("description", "Description column", true)}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            id="date-order"
            label="Dates are written"
            hint={dateGuess.certain ? undefined : "Couldn't tell from the file — please check"}
          >
            <select
              id="date-order"
              className={selectClass}
              value={dateOrder}
              onChange={(e) => setDateOrder(e.target.value as DateOrder)}
            >
              <option value="DMY">Day / month / year</option>
              <option value="MDY">Month / day / year</option>
              <option value="YMD">Year - month - day</option>
            </select>
          </Field>
          <Field id="sign-mode" label="Which rows are spending">
            <select
              id="sign-mode"
              className={selectClass}
              value={signMode}
              onChange={(e) => setSignMode(e.target.value as SignMode)}
            >
              <option value="negatives">Negative amounts only</option>
              <option value="all">Every row</option>
            </select>
          </Field>
          <Field id="import-category" label="Put them in">
            <select
              id="import-category"
              className={selectClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="rounded-lg bg-muted px-4 py-3 text-sm">
          <p className="font-medium">
            {toImport.length} {toImport.length === 1 ? "expense" : "expenses"} ·{" "}
            {formatCents(total, currency)}
            {months.length > 0 &&
              ` · ${formatMonthKey(months[0])}${
                months.length > 1 ? ` – ${formatMonthKey(months[months.length - 1])}` : ""
              }`}
          </p>
          <p className="text-muted-foreground">
            {[
              duplicates && `${duplicates} already logged (skipped)`,
              plan.skippedCredits &&
                `${plan.skippedCredits} money-in ${plan.skippedCredits === 1 ? "row" : "rows"} skipped`,
              plan.skippedInvalid &&
                `${plan.skippedInvalid} ${plan.skippedInvalid === 1 ? "row" : "rows"} without a valid date or amount`,
            ]
              .filter(Boolean)
              .join(" · ") || "Nothing skipped"}
          </p>
          {unsavedMonths.length > 0 && (
            <p className="mt-1 flex gap-1.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {unsavedMonths.map(formatMonthKey).join(", ")}{" "}
              {unsavedMonths.length === 1 ? "isn't" : "aren't"} added yet. Those expenses will show
              once you add {unsavedMonths.length === 1 ? "that month" : "those months"}.
            </p>
          )}
        </div>

        {plan.rows.length > 0 && (
          <div className="max-h-56 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className={r.duplicate ? "border-t text-muted-foreground line-through" : "border-t"}>
                    <td className="whitespace-nowrap px-3 py-1.5">{r.date}</td>
                    <td className="px-3 py-1.5">{r.description || "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {formatCents(r.amountCents, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {plan.rows.length > 50 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                …and {plan.rows.length - 50} more
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || toImport.length === 0} onClick={doImport}>
            {busy ? "Importing…" : `Import ${toImport.length}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
