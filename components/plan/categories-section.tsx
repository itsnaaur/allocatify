"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { SortableCategoryCard } from "@/components/budget/sortable-category-card";
import { TemplateSelector } from "@/components/budget/template-selector";
import { AutoSplitNote } from "@/components/plan/auto-split";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus, RotateCcw, AlertTriangle } from "lucide-react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

function AddCategoryButton() {
  const addCategory = useBudgetStore((s) => s.addCategory);
  const [name, setName] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Type a name first");
      return;
    }
    if (addCategory(trimmed)) {
      setName("");
      setError(undefined);
      setIsAdding(false);
    } else {
      setError(`"${trimmed}" already exists`);
    }
  };

  if (isAdding) {
    return (
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
            if (e.key === "Escape") setIsAdding(false);
          }}
          placeholder="Category name"
          aria-label="New category name"
          aria-invalid={!!error}
          className="flex h-10 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          autoFocus
        />
        <Button size="sm" onClick={handleAdd}>
          Add
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
          Cancel
        </Button>
        {error && <p className="w-full text-xs text-destructive">{error}</p>}
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

/** Spending categories for the month: template, reset, add, reorder, edit. */
export function CategoriesSection() {
  const categories = useBudgetStore((s) => s.categories);
  const totalCents = useBudgetStore((s) => s.totalCents);
  const budgetName = useBudgetStore((s) => s.budgetName);
  const reset = useBudgetStore((s) => s.reset);
  const reorderCategories = useBudgetStore((s) => s.reorderCategories);
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);

  const handleConfirmReset = () => {
    reset();
    setResetDialogOpen(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = categories.findIndex((c) => c.id === active.id);
    const toIndex = categories.findIndex((c) => c.id === over.id);
    if (fromIndex >= 0 && toIndex >= 0) reorderCategories(fromIndex, toIndex);
  };

  return (
    <section>
      <div className="mb-4 space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Spending categories</h3>
          <p className="text-sm text-muted-foreground">
            Tick must-haves so savings suggestions never touch them. <AutoSplitNote />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TemplateSelector />
          <AddCategoryButton />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setResetDialogOpen(true)}
            aria-label="Reset this month's categories"
            className="text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={categories.map((c) => c.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <SortableCategoryCard
                key={cat.id}
                category={cat}
                totalCents={totalCents}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
    </section>
  );
}
