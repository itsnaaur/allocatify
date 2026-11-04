"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { generateCSV, generateCSVForYear, downloadCSV, getBudgetsForYear } from "@/lib/export-utils";
import { formatCents, percentOf } from "@/lib/math-engine";
import { Button } from "@/components/ui/button";
import { Download, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import type { BudgetSchema } from "@/lib/schema-validator";

type PreviewType = "csv" | "pdf" | null;
type ExportScope = { type: "current" } | { type: "month"; monthKey: string } | { type: "year"; year: number };

export function DataPorter() {
  const totalCents = useBudgetStore((s) => s.totalCents);
  const categories = useBudgetStore((s) => s.categories);
  const budgetId = useBudgetStore((s) => s.budgetId);
  const budgetName = useBudgetStore((s) => s.budgetName);
  const monthKey = useBudgetStore((s) => s.monthKey);
  const currency = useBudgetStore((s) => s.currency);
  const monthlyBudgets = useBudgetStore((s) => s.monthlyBudgets);

  const [previewType, setPreviewType] = React.useState<PreviewType>(null);
  const [exportScope, setExportScope] = React.useState<ExportScope>({ type: "current" });
  const [csvContent, setCsvContent] = React.useState("");
  const [pdfBlobUrl, setPdfBlobUrl] = React.useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = React.useState(false);

  const currentBudget = React.useMemo<BudgetSchema>(
    () => ({
      id: budgetId,
      name: budgetName,
      monthKey: monthKey ?? undefined,
      totalCents,
      categories,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    [budgetId, budgetName, monthKey, totalCents, categories]
  );

  const exportBudget = React.useMemo((): BudgetSchema | null => {
    if (exportScope.type === "current") return currentBudget;
    if (exportScope.type === "month") {
      const b = monthlyBudgets.find(
        (x) => (x.monthKey ?? x.id) === exportScope.monthKey
      );
      return (b ?? currentBudget) as BudgetSchema;
    }
    return null;
  }, [exportScope, currentBudget, monthlyBudgets]);

  const exportBudgetsForYear = React.useMemo((): BudgetSchema[] => {
    if (exportScope.type !== "year") return [];
    return getBudgetsForYear(monthlyBudgets as BudgetSchema[], exportScope.year);
  }, [exportScope, monthlyBudgets]);

  const isYearExport = exportScope.type === "year";

  const years = React.useMemo(() => {
    const set = new Set<number>();
    for (const b of monthlyBudgets) {
      const key = b.monthKey ?? b.id ?? "";
      const m = key.match(/^(\d{4})-/);
      if (m) set.add(parseInt(m[1], 10));
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [monthlyBudgets]);

  const slug = React.useMemo(() => {
    if (exportScope.type === "current")
      return monthKey ?? new Date().toISOString().slice(0, 7);
    if (exportScope.type === "month") return exportScope.monthKey;
    return `year-${exportScope.year}`;
  }, [exportScope, monthKey]);

  const refreshPreview = React.useCallback(() => {
    if (previewType === "csv") {
      if (isYearExport) {
        setCsvContent(generateCSVForYear(exportBudgetsForYear, currency));
      } else {
        setCsvContent(generateCSV(exportBudget!, currency));
      }
    } else if (previewType === "pdf") {
      setIsPdfLoading(true);
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      // The PDF library is large: load it only when a PDF preview is opened.
      Promise.all([import("@react-pdf/renderer"), import("@/components/export/pdf-report")])
        .then(([{ pdf }, { PDFReport }]) =>
          pdf(
            <PDFReport
              budget={isYearExport ? undefined : exportBudget ?? undefined}
              budgets={isYearExport ? exportBudgetsForYear : undefined}
              currency={currency}
              generatedAt={new Date().toLocaleString()}
            />
          ).toBlob()
        )
        .then((blob) => {
          setPdfBlobUrl(URL.createObjectURL(blob));
        })
        .finally(() => setIsPdfLoading(false));
    }
  }, [previewType, exportBudget, exportBudgetsForYear, isYearExport, currency]);

  React.useEffect(() => {
    if (previewType) refreshPreview();
  }, [exportScope, previewType, refreshPreview]);

  const openCsvPreview = () => {
    setExportScope({ type: "current" });
    setCsvContent(generateCSV(currentBudget, currency));
    setPreviewType("csv");
  };

  // The preview effect above generates the PDF once previewType/exportScope change,
  // so opening only sets state (generating here too rendered the PDF twice).
  const openPdfPreview = () => {
    setExportScope({ type: "current" });
    setIsPdfLoading(true);
    setPreviewType("pdf");
  };

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

  const closePreview = React.useCallback(() => {
    setPreviewType(null);
    setPdfBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (open === false) closePreview();
    },
    [closePreview]
  );

  const ScopeSelector = (
    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
      <label htmlFor="export-scope" className="text-sm font-medium shrink-0">
        Export:
      </label>
      <select
        id="export-scope"
        value={
          exportScope.type === "current"
            ? "current"
            : exportScope.type === "month"
              ? `month:${exportScope.monthKey}`
              : `year:${exportScope.year}`
        }
        onChange={(e) => {
          const v = e.target.value;
          if (v === "current") setExportScope({ type: "current" });
          else if (v.startsWith("month:"))
            setExportScope({ type: "month", monthKey: v.slice(6) });
          else if (v.startsWith("year:"))
            setExportScope({ type: "year", year: parseInt(v.slice(5), 10) });
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
          <>
            <optgroup label="Whole year">
              {years.map((y) => (
                <option key={y} value={`year:${y}`}>
                  {y} (all months)
                </option>
              ))}
            </optgroup>
          </>
        )}
      </select>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openCsvPreview}
          aria-label="Preview and export CSV"
        >
          <Download className="h-4 w-4" />
          CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openPdfPreview}
          aria-label="Preview and export PDF"
        >
          <FileText className="h-4 w-4" />
          PDF
        </Button>
      </div>

      {previewType && (
        <Dialog open={true} onOpenChange={handleOpenChange}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85dvh] sm:max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <DialogTitle className="text-left">
              {previewType === "csv" && "CSV Preview"}
              {previewType === "pdf" && "PDF Preview"}
            </DialogTitle>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </DialogHeader>

          {previewType === "csv" && (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              {ScopeSelector}
              <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg border max-h-[45vh] sm:max-h-[50vh]">
                {isYearExport ? (
                  exportBudgetsForYear.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No data for this year yet.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {exportBudgetsForYear.map((b) => (
                        <div key={b.id} className="p-3">
                          <p className="text-sm font-semibold mb-2">{b.name}</p>
                          <table className="w-full text-sm min-w-[280px]">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left font-semibold p-2">Category</th>
                                <th className="text-right font-semibold p-2">Allocated</th>
                                <th className="text-right font-semibold p-2">%</th>
                              </tr>
                            </thead>
                            <tbody>
                              {b.categories.map((cat) => (
                                <tr key={cat.id} className="border-b last:border-b-0">
                                  <td className="p-2">{cat.name}</td>
                                  <td className="p-2 text-right font-mono">
                                    {formatCents(cat.allocatedCents, currency)}
                                  </td>
                                  <td className="p-2 text-right text-muted-foreground">
                                    {b.totalCents > 0
                                      ? percentOf(cat.allocatedCents, b.totalCents).toFixed(1)
                                      : "0"}
                                    %
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-t bg-muted/30 font-medium">
                                <td className="p-2">Allocated</td>
                                <td className="p-2 text-right font-mono">
                                  {formatCents(
                                    b.categories.reduce((s, c) => s + c.allocatedCents, 0),
                                    currency
                                  )}
                                </td>
                                <td className="p-2 text-right text-muted-foreground">
                                  {b.totalCents > 0
                                    ? percentOf(
                                        b.categories.reduce((s, c) => s + c.allocatedCents, 0),
                                        b.totalCents
                                      ).toFixed(1)
                                    : "0"}
                                  %
                                </td>
                              </tr>
                              <tr className="border-b bg-muted/30 font-medium">
                                <td className="p-2">Remaining</td>
                                <td className="p-2 text-right font-mono">
                                  {formatCents(
                                    b.totalCents -
                                      b.categories.reduce((s, c) => s + c.allocatedCents, 0),
                                    currency
                                  )}
                                </td>
                                <td className="p-2 text-right text-muted-foreground">
                                  {b.totalCents > 0
                                    ? percentOf(
                                        b.totalCents -
                                          b.categories.reduce((s, c) => s + c.allocatedCents, 0),
                                        b.totalCents
                                      ).toFixed(1)
                                    : "0"}
                                  %
                                </td>
                              </tr>
                              <tr className="border-t-2 bg-muted/50 font-semibold">
                                <td className="p-2">Total</td>
                                <td className="p-2 text-right font-mono">
                                  {formatCents(b.totalCents, currency)}
                                </td>
                                <td className="p-2 text-right">100%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground p-3 pb-0">{exportBudget?.name}</p>
                    <table className="w-full text-sm min-w-[280px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left font-semibold p-2 sm:p-3">Category</th>
                          <th className="text-right font-semibold p-2 sm:p-3">Allocated</th>
                          <th className="text-right font-semibold p-2 sm:p-3">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exportBudget?.categories.map((cat) => (
                          <tr key={cat.id} className="border-b last:border-b-0">
                            <td className="p-2 sm:p-3">{cat.name}</td>
                            <td className="p-2 sm:p-3 text-right font-mono">
                              {formatCents(cat.allocatedCents, currency)}
                            </td>
                            <td className="p-2 sm:p-3 text-right text-muted-foreground">
                              {exportBudget && exportBudget.totalCents > 0
                                ? percentOf(cat.allocatedCents, exportBudget.totalCents).toFixed(1)
                                : "0"}
                              %
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t bg-muted/30 font-medium">
                          <td className="p-2 sm:p-3">Allocated</td>
                          <td className="p-2 sm:p-3 text-right font-mono">
                            {formatCents(
                              exportBudget?.categories.reduce((s, c) => s + c.allocatedCents, 0) ?? 0,
                              currency
                            )}
                          </td>
                          <td className="p-2 sm:p-3 text-right text-muted-foreground">
                            {exportBudget && exportBudget.totalCents > 0
                              ? percentOf(
                                  exportBudget.categories.reduce((s, c) => s + c.allocatedCents, 0),
                                  exportBudget.totalCents
                                ).toFixed(1)
                              : "0"}
                            %
                          </td>
                        </tr>
                        <tr className="border-b bg-muted/30 font-medium">
                          <td className="p-2 sm:p-3">Remaining</td>
                          <td className="p-2 sm:p-3 text-right font-mono">
                            {formatCents(
                              (exportBudget?.totalCents ?? 0) -
                                (exportBudget?.categories.reduce((s, c) => s + c.allocatedCents, 0) ?? 0),
                              currency
                            )}
                          </td>
                          <td className="p-2 sm:p-3 text-right text-muted-foreground">
                            {exportBudget && exportBudget.totalCents > 0
                              ? percentOf(
                                  (exportBudget.totalCents -
                                    exportBudget.categories.reduce((s, c) => s + c.allocatedCents, 0)),
                                  exportBudget.totalCents
                                ).toFixed(1)
                              : "0"}
                            %
                          </td>
                        </tr>
                        <tr className="border-t-2 bg-muted/50 font-semibold">
                          <td className="p-2 sm:p-3">Total</td>
                          <td className="p-2 sm:p-3 text-right font-mono">
                            {formatCents(exportBudget?.totalCents ?? 0, currency)}
                          </td>
                          <td className="p-2 sm:p-3 text-right">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}
              </div>
              <Button type="button" onClick={handleDownloadCsv} className="w-full sm:w-auto">
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          )}

          {previewType === "pdf" && (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              {ScopeSelector}
              {isPdfLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  Generating preview…
                </div>
              ) : pdfBlobUrl ? (
                <>
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full h-[50vh] min-h-[280px] sm:h-[60vh] sm:min-h-[400px] rounded-lg border"
                    title="PDF preview"
                  />
                  <Button type="button" onClick={handleDownloadPdf} className="w-full sm:w-auto">
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </>
              ) : null}
            </div>
          )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
