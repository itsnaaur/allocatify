"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useBudgetStore } from "@/store/budget-store";
import { exportAllData, replaceAllData, resetAllData } from "@/lib/db";
import {
  backupFileName,
  buildBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
  summarizeBackup,
  type BackupFile,
} from "@/lib/backup";
import { formatMonthKey } from "@/lib/month-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { useExportDialog } from "@/components/export-dialog";
import { cn } from "@/lib/utils";

const LAST_BACKUP_KEY = "allocatify-last-backup";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function lastBackupLabel(iso: string | null): string {
  if (!iso) return "Never backed up";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Last backup: today";
  if (days === 1) return "Last backup: yesterday";
  return `Last backup: ${days} days ago`;
}

/** Save everything to a file the user keeps. */
async function downloadBackup(): Promise<void> {
  await useBudgetStore.getState().persist(); // include the latest edits
  const data = await exportAllData();
  if (!data) return;
  const now = new Date();
  const blob = new Blob([JSON.stringify(buildBackup(data, now), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName(now);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  localStorage.setItem(LAST_BACKUP_KEY, now.toISOString());
}

/** The ⋯ menu: exports, backup, restore, delete all. */
export function DataMenu() {
  const openExport = useExportDialog((s) => s.open);
  const [open, setOpen] = React.useState(false);
  const [lastBackup, setLastBackup] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<BackupFile | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLastBackup(localStorage.getItem(LAST_BACKUP_KEY));
  }, [open]);

  const onDownload = async () => {
    await downloadBackup();
    setLastBackup(localStorage.getItem(LAST_BACKUP_KEY));
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError("This file is too large to be an Allocatify backup. Nothing was changed.");
      return;
    }
    const result = parseBackup(await file.text());
    if (result.ok) setPending(result.file);
    else setError(result.error);
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await replaceAllData(pending.data);
      window.location.reload(); // start fresh from the restored data
    } catch {
      setBusy(false);
      setPending(null);
      setError("The backup couldn't be restored. Your data was left as it was.");
    }
  };

  const deleteEverything = async () => {
    setBusy(true);
    await resetAllData();
    localStorage.removeItem(LAST_BACKUP_KEY);
    window.location.reload();
  };

  const summary = pending ? summarizeBackup(pending) : null;
  const itemClass =
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer outline-none hover:bg-accent focus:bg-accent";

  return (
    <>
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon" aria-label="Export, backup and data options">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          className="z-50 min-w-[250px] rounded-lg border bg-card p-1 shadow-md"
          align="end"
          sideOffset={6}
        >
          <DropdownMenu.Label className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
            Export
          </DropdownMenu.Label>
          <DropdownMenu.Item className={itemClass} onSelect={() => openExport("csv")}>
            <FileSpreadsheet className="h-4 w-4" />
            Export CSV…
          </DropdownMenu.Item>
          <DropdownMenu.Item className={itemClass} onSelect={() => openExport("pdf")}>
            <FileText className="h-4 w-4" />
            Export PDF report…
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Label className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
            Backup · {lastBackupLabel(lastBackup)}
          </DropdownMenu.Label>
          <DropdownMenu.Item className={itemClass} onSelect={onDownload}>
            <Download className="h-4 w-4" />
            Download backup
          </DropdownMenu.Item>
          <DropdownMenu.Item className={itemClass} onSelect={() => fileInput.current?.click()}>
            <Upload className="h-4 w-4" />
            Restore from backup…
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className={cn(itemClass, "text-destructive")}
            onSelect={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete all my data…
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={onFile}
        aria-hidden
        tabIndex={-1}
      />

      {/* Restore preview */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
          </DialogHeader>
          {summary && (
            <ul className="space-y-1 rounded-lg bg-muted px-4 py-3 text-sm">
              {summary.exportedAt && (
                <li>
                  Saved{" "}
                  {new Date(summary.exportedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </li>
              )}
              <li>
                {summary.months} {summary.months === 1 ? "month" : "months"}
                {summary.firstMonth && summary.lastMonth && (
                  <>
                    {" "}
                    ({formatMonthKey(summary.firstMonth)}
                    {summary.firstMonth !== summary.lastMonth &&
                      ` – ${formatMonthKey(summary.lastMonth)}`}
                    )
                  </>
                )}
              </li>
              <li>
                {plural(summary.loansAndBills, "loan or bill", "loans & bills")} ·{" "}
                {plural(summary.goals, "goal", "goals")} ·{" "}
                {plural(summary.expenses, "expense", "expenses")}
              </li>
              <li>Currency: {summary.currency}</li>
            </ul>
          )}
          <p className="flex gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            This replaces everything currently in Allocatify on this device.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={onDownload}>
              <Download className="h-4 w-4" />
              Back up current data first
            </Button>
            <DialogClose asChild>
              <Button variant="outline" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={busy} onClick={restore}>
              {busy ? "Restoring…" : "Replace with backup"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Problem with the file */}
      <Dialog open={!!error} onOpenChange={(o) => !o && setError(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Couldn&apos;t restore that file</DialogTitle>
            <p className="text-sm text-muted-foreground">{error}</p>
          </DialogHeader>
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button>OK</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete everything */}
      <Dialog open={confirmDelete} onOpenChange={(o) => !busy && setConfirmDelete(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete all your Allocatify data?</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Every month, loan, bill, goal and expense on this device is removed. This
              can&apos;t be undone unless you have a backup.
            </p>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={onDownload}>
              <Download className="h-4 w-4" />
              Download a backup first
            </Button>
            <DialogClose asChild>
              <Button variant="outline" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={busy} onClick={deleteEverything}>
              Delete everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
