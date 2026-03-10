"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { generateCSV, downloadCSV } from "@/lib/export-utils";
import { formatCents, percentOf } from "@/lib/math-engine";
import { pdf } from "@react-pdf/renderer";
import { PDFReport } from "@/components/export/pdf-report";
import { Button } from "@/components/ui/button";
import { Download, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

type PreviewType = "csv" | "pdf" | null;

export function DataPorter() {
  const totalCents = useBudgetStore((s) => s.totalCents);
  const categories = useBudgetStore((s) => s.categories);
  const budgetId = useBudgetStore((s) => s.budgetId);
  const budgetName = useBudgetStore((s) => s.budgetName);
  const monthKey = useBudgetStore((s) => s.monthKey);
  const currency = useBudgetStore((s) => s.currency);

  const [previewType, setPreviewType] = React.useState<PreviewType>(null);
  const [csvContent, setCsvContent] = React.useState("");
  const [pdfBlobUrl, setPdfBlobUrl] = React.useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = React.useState(false);

  const budget = React.useMemo(
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

  const slug = monthKey ?? new Date().toISOString().slice(0, 7);

  const openCsvPreview = () => {
    const csv = generateCSV(budget, currency);
    setCsvContent(csv);
    setPreviewType("csv");
  };

  const openPdfPreview = async () => {
    setIsPdfLoading(true);
    setPreviewType("pdf");
    try {
      const doc = (
        <PDFReport
          budget={budget}
          currency={currency}
          generatedAt={new Date().toLocaleString()}
        />
      );
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } finally {
      setIsPdfLoading(false);
    }
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
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
              <p className="text-sm text-muted-foreground">{budgetName}</p>
              <div className="flex-1 overflow-auto rounded-lg border max-h-[50vh]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left font-semibold p-3">Category</th>
                      <th className="text-right font-semibold p-3">Allocated</th>
                      <th className="text-right font-semibold p-3">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budget.categories.map((cat) => (
                      <tr key={cat.id} className="border-b last:border-b-0">
                        <td className="p-3">{cat.name}</td>
                        <td className="p-3 text-right font-mono">
                          {formatCents(cat.allocatedCents, currency)}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {budget.totalCents > 0
                            ? percentOf(cat.allocatedCents, budget.totalCents).toFixed(1)
                            : "0"}
                          %
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/30 font-medium">
                      <td className="p-3">Allocated</td>
                      <td className="p-3 text-right font-mono">
                        {formatCents(
                          budget.categories.reduce((s, c) => s + c.allocatedCents, 0),
                          currency
                        )}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {budget.totalCents > 0
                          ? percentOf(
                              budget.categories.reduce((s, c) => s + c.allocatedCents, 0),
                              budget.totalCents
                            ).toFixed(1)
                          : "0"}
                        %
                      </td>
                    </tr>
                    <tr className="border-b bg-muted/30 font-medium">
                      <td className="p-3">Remaining</td>
                      <td className="p-3 text-right font-mono">
                        {formatCents(
                          budget.totalCents -
                            budget.categories.reduce((s, c) => s + c.allocatedCents, 0),
                          currency
                        )}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {budget.totalCents > 0
                          ? percentOf(
                              budget.totalCents -
                                budget.categories.reduce((s, c) => s + c.allocatedCents, 0),
                              budget.totalCents
                            ).toFixed(1)
                          : "0"}
                        %
                      </td>
                    </tr>
                    <tr className="border-t-2 bg-muted/50 font-semibold">
                      <td className="p-3">Total</td>
                      <td className="p-3 text-right font-mono">
                        {formatCents(budget.totalCents, currency)}
                      </td>
                      <td className="p-3 text-right">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Button type="button" onClick={handleDownloadCsv} className="w-full sm:w-auto">
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          )}

          {previewType === "pdf" && (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              {isPdfLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  Generating preview…
                </div>
              ) : pdfBlobUrl ? (
                <>
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full h-[60vh] min-h-[400px] rounded-lg border"
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
