"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore } from "@/store/planner-store";
import { downloadCSV, getBudgetsForYear, reportsCSV } from "@/lib/export-utils";
import { buildMonthReport, type MonthReport } from "@/lib/report";
import { parseCsvRows } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Download, FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import type { BudgetSchema } from "@/lib/schema-validator";

type PreviewType = "csv" | "pdf" | null;
type ExportScope = { type: "current" } | { type: "month"; monthKey: string } | { type: "year"; year: number };

/** CSV and PDF exports of one month or a whole year, with loans, goals and expenses. */
export function DataPorter() {
  const budgetState = useBudgetStore();
  const { monthKey, budgetName, currency, monthlyBudgets } = budgetState;
  const planner = usePlannerStore();

  const [previewType, setPreviewType] = React.useState<PreviewType>(null);
  const [exportScope, setExportScope] = React.useState<ExportScope>({ type: "current" });
  const [pdfBlobUrl, setPdfBlobUrl] = React.useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = React.useState(false);

  /** The month on screen, including edits that may not be saved yet. */
  const currentBudget = React.useMemo<BudgetSchema>(
    () => ({
      id: budgetState.budgetId,
      name: budgetState.budgetName,
      monthKey: budgetState.monthKey ?? undefined,
      totalCents: budgetState.totalCents,
      categories: budgetState.categories,
      carryInCents: budgetState.carryInCents,
      carryInFrom: budgetState.carryInFrom ?? undefined,
      carryOutCents: budgetState.carryOutCents,
      createdAt: budgetState.createdAt,
      updatedAt: Date.now(),
    }),
    [budgetState]
  );

  const reports = React.useMemo<MonthReport[]>(() => {
    const data = {
      obligations: planner.obligations,
      payments: planner.payments,
      goals: planner.goals,
      contributions: planner.contributions,
      expenses: planner.expenses,
    };
    const live = (b: BudgetSchema) =>
      (b.monthKey ?? b.id) === currentBudget.monthKey ? currentBudget : b;
    let budgets: BudgetSchema[];
    if (exportScope.type === "current") budgets = [currentBudget];
    else if (exportScope.type === "month")
      budgets = [
        live(monthlyBudgets.find((b) => (b.monthKey ?? b.id) === exportScope.monthKey) ?? currentBudget),
      ];
    else budgets = getBudgetsForYear(monthlyBudgets.map(live), exportScope.year);
    return budgets.map((b) => buildMonthReport(b, data));
  }, [exportScope, currentBudget, monthlyBudgets, planner]);

  const csvContent = React.useMemo(() => reportsCSV(reports, currency), [reports, currency]);

  const years = React.useMemo(() => {
    const set = new Set<number>();
    for (const b of monthlyBudgets) {
      const m = (b.monthKey ?? b.id ?? "").match(/^(\d{4})-/);
      if (m) set.add(parseInt(m[1], 10));
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [monthlyBudgets]);

  const slug =
    exportScope.type === "current"
      ? monthKey ?? new Date().toISOString().slice(0, 7)
      : exportScope.type === "month"
        ? exportScope.monthKey
        : `year-${exportScope.year}`;

  // Build the PDF whenever the PDF preview is open and what it shows changes.
  React.useEffect(() => {
    if (previewType !== "pdf") return;
    let cancelled = false;
    setIsPdfLoading(true);
    setPdfBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    // The PDF library is large: load it only when a PDF preview is opened.
    Promise.all([import("@react-pdf/renderer"), import("@/components/export/pdf-report")])
      .then(([{ pdf }, { PDFReport }]) =>
        pdf(
          <PDFReport reports={reports} currency={currency} generatedAt={new Date().toLocaleString()} />
        ).toBlob()
      )
      .then((blob) => {
        if (!cancelled) setPdfBlobUrl(URL.createObjectURL(blob));
      })
      .finally(() => !cancelled && setIsPdfLoading(false));
    return () => {
      cancelled = true;
    };
  }, [previewType, reports, currency]);

  const open = (type: PreviewType) => {
    setExportScope({ type: "current" });
    setPreviewType(type);
  };

  const closePreview = React.useCallback(() => {
    setPreviewType(null);
    setPdfBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleDownloadCsv = () => {
    downloadCSV(csvContent, `allocatify-${slug}.csv`);
    closePreview();
  };

  const handleDownloadPdf = () => {
    if (!pdfBlobUrl) return;
    const a = document.createElement("a");
    a.href = pdfBlobUrl;
    a.download = `allocatify-${slug}.pdf`;
    a.click();
    closePreview();
  };

  const scopeValue =
    exportScope.type === "current"
      ? "current"
      : exportScope.type === "month"
        ? `month:${exportScope.monthKey}`
        : `year:${exportScope.year}`;

  const ScopeSelector = (
    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
      <label htmlFor="export-scope" className="text-sm font-medium shrink-0">
        Export:
      </label>
      <select
        id="export-scope"
        value={scopeValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "current") setExportScope({ type: "current" });
          else if (v.startsWith("month:")) setExportScope({ type: "month", monthKey: v.slice(6) });
          else if (v.startsWith("year:")) setExportScope({ type: "year", year: parseInt(v.slice(5), 10) });
        }}
        className="rounded-lg border border-input bg-background px-3 py-2 text-sm w-full sm:w-auto min-w-[180px]"
      >
        <option value="current">This month ({budgetName})</option>
        {monthlyBudgets.map((b) => {
          const key = b.monthKey ?? b.id;
          return (
            <option key={key} value={`month:${key}`}>
              {b.name}
            </option>
          );
        })}
        {years.length > 0 && (
          <optgroup label="Whole year">
            {years.map((y) => (
              <option key={y} value={`year:${y}`}>
                {y} (all months)
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => open("csv")} aria-label="Preview and export CSV">
          <Download className="h-4 w-4" />
          CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => open("pdf")} aria-label="Preview and export PDF">
          <FileText className="h-4 w-4" />
          PDF
        </Button>
      </div>

      {previewType && (
        <Dialog open onOpenChange={(o) => !o && closePreview()}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[85dvh] sm:max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
            <DialogHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <DialogTitle className="text-left">
                {previewType === "csv" ? "CSV Preview" : "PDF Preview"}
              </DialogTitle>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </DialogHeader>

            <div className="flex flex-col gap-4 flex-1 min-h-0">
              {ScopeSelector}
              {reports.length === 0 ? (
                <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                  No months saved for this year yet.
                </div>
              ) : previewType === "csv" ? (
                <div className="flex-1 overflow-auto rounded-lg border max-h-[50vh]">
                  <CsvPreview content={csvContent} />
                </div>
              ) : (
                <div className="flex-1 min-h-[50vh] overflow-hidden rounded-lg border bg-muted/30">
                  {isPdfLoading || !pdfBlobUrl ? (
                    <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
                      Generating preview…
                    </div>
                  ) : (
                    <iframe src={pdfBlobUrl} title="PDF preview" className="h-full min-h-[50vh] w-full" />
                  )}
                </div>
              )}
              <Button
                type="button"
                className="w-full"
                disabled={reports.length === 0 || (previewType === "pdf" && !pdfBlobUrl)}
                onClick={previewType === "csv" ? handleDownloadCsv : handleDownloadPdf}
              >
                <Download className="h-4 w-4" />
                {previewType === "csv" ? "Download CSV" : "Download PDF"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** Shows the CSV as tables: one-cell lines are titles, the line after a title is a header. */
function CsvPreview({ content }: { content: string }) {
  const rows = parseCsvRows(content, ",");
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((cells, i) => {
          if (cells.length === 1 && cells[0] === "") return <tr key={i} className="h-3" />;
          if (cells.length === 1)
            return (
              <tr key={i}>
                <th colSpan={5} className="bg-muted px-3 py-2 text-left font-semibold">
                  {cells[0]}
                </th>
              </tr>
            );
          const isHeader = rows[i - 1]?.length === 1 && rows[i - 1][0] !== "";
          return (
            <tr key={i} className={isHeader ? "text-xs text-muted-foreground" : "border-t"}>
              {cells.map((c, j) => (
                <td key={j} className="whitespace-nowrap px-3 py-1.5">
                  {c.replace(/^'(?=[=+\-@])/, "")}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
