"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { TotalInput } from "@/components/budget/total-input";
import { CategoryCard } from "@/components/budget/category-card";
import { AllocationSummary } from "@/components/budget/allocation-summary";
import { AllocationChart } from "@/components/budget/allocation-chart";
import { TemplateSelector } from "@/components/budget/template-selector";
import { DataPorter } from "@/components/data-porter";
import { ThemeToggle } from "@/components/theme-toggle";
import { CurrencySelector } from "@/components/currency-selector";
import { MonthSwitcher } from "@/components/month-switcher";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus, RotateCcw, AlertTriangle } from "lucide-react";

function AddCategoryButton() {
  const addCategory = useBudgetStore((s) => s.addCategory);
  const [name, setName] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (trimmed) {
      addCategory(trimmed);
      setName("");
      setIsAdding(false);
    }
  };

  if (isAdding) {
    return (
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
            if (e.key === "Escape") setIsAdding(false);
          }}
          placeholder="Category name"
          className="flex h-10 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          autoFocus
        />
        <Button size="sm" onClick={handleAdd}>
          Add
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" onClick={() => setIsAdding(true)} aria-label="Add new category">
      <Plus className="h-4 w-4" />
      Add Category
    </Button>
  );
}

function HydrationGuard({ children }: { children: React.ReactNode }) {
  const isHydrated = useBudgetStore((s) => s.isHydrated);
  const hydrate = useBudgetStore((s) => s.hydrate);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading your budget…</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default function Home() {
  const categories = useBudgetStore((s) => s.categories);
  const totalCents = useBudgetStore((s) => s.totalCents);
  const budgetName = useBudgetStore((s) => s.budgetName);
  const reset = useBudgetStore((s) => s.reset);
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);

  const handleConfirmReset = () => {
    reset();
    setResetDialogOpen(false);
  };

  return (
    <HydrationGuard>
      <div className="min-h-screen bg-background px-12 sm:px-20 md:px-32 lg:px-40">
        {/* Nav: currency + theme only */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">Allocatify</h1>
            <div className="flex items-center gap-2">
              <CurrencySelector />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl py-8">
          {/* Hero: centered */}
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Map your financial future
            </h2>
            <p className="mt-2 text-muted-foreground">
              Zero sign-up. Your data stays on your device.
            </p>
          </div>

          {/* Tools row: month switcher, templates, reset, export/import */}
          <div className="mb-8 flex flex-wrap items-center justify-center gap-4 sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <MonthSwitcher />
              <TemplateSelector />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setResetDialogOpen(true)}
                aria-label="Reset this month"
                className="text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
            <DataPorter />
          </div>

          {/* Total + Summary: side by side */}
          <section className="mb-8">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <TotalInput />
              </div>
              <div className="lg:col-span-2">
                <AllocationSummary />
              </div>
            </div>
          </section>

          {/* Allocation chart: full width, centered */}
          <section className="mb-8">
            <h3 className="mb-4 text-lg font-semibold">Allocation</h3>
            <div className="rounded-xl border bg-card p-6">
              <AllocationChart />
            </div>
          </section>

          {/* Categories */}
          <section>
            <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <h3 className="text-lg font-semibold">Categories</h3>
              <AddCategoryButton />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  totalCents={totalCents}
                />
              ))}
            </div>
          </section>
        </main>

        {/* Footer: same max-width and horizontal padding as nav + main */}
        <footer className="mt-16 border-t py-8">
          <div className="mx-auto max-w-5xl text-center text-sm text-muted-foreground">
            Allocatify · Your data never leaves your device · No accounts required
          </div>
        </footer>

        {/* Reset confirmation dialog */}
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader className="flex flex-row items-start gap-3">
              <div className="rounded-full bg-destructive/10 p-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <DialogTitle>Reset {budgetName}?</DialogTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  This will clear the following for this month:
                </p>
                <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>Total budget amount</li>
                  <li>All category allocations</li>
                  <li>Category names and amounts</li>
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">
                  Your month will be reset to the default template. This cannot be undone.
                </p>
              </div>
            </DialogHeader>
            <div className="flex gap-2 justify-end mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmReset}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </HydrationGuard>
  );
}
