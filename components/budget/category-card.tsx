"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { toCents, formatCents, percentOf, fromCents, sanitizeAmountInput } from "@/lib/math-engine";
import { CURRENCIES } from "@/lib/currencies";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { CategorySchema } from "@/lib/schema-validator";

interface CategoryCardProps {
  category: CategorySchema;
  totalCents: number;
  /** Optional drag handle (e.g. for sortable) */
  dragHandle?: React.ReactNode;
}

export function CategoryCard({ category, totalCents, dragHandle }: CategoryCardProps) {
  const currency = useBudgetStore((s) => s.currency);
  const setCategoryAllocation = useBudgetStore((s) => s.setCategoryAllocation);
  const removeCategory = useBudgetStore((s) => s.removeCategory);
  const renameCategory = useBudgetStore((s) => s.renameCategory);
  const toggleEssential = useBudgetStore((s) => s.toggleEssential);
  const [nameError, setNameError] = React.useState<string>();
  const minorUnits = CURRENCIES[currency].minorUnitsPerMajor;
  const symbol = CURRENCIES[currency].symbol;

  const [localValue, setLocalValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [editName, setEditName] = React.useState(category.name);

  // Only sync from store when NOT focused
  React.useEffect(() => {
    if (!isFocused) {
      setLocalValue(
        category.allocatedCents === 0 ? "" : fromCents(category.allocatedCents, minorUnits)
      );
    }
  }, [category.allocatedCents, minorUnits, isFocused]);

  React.useEffect(() => {
    setEditName(category.name);
  }, [category.name]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = sanitizeAmountInput(e.target.value, minorUnits === 1 ? 0 : 2);
    setLocalValue(v);
    setCategoryAllocation(category.id, toCents(v, minorUnits));
  };

  const handleAmountFocus = () => setIsFocused(true);

  const handleAmountBlur = () => {
    setIsFocused(false);
    if (category.allocatedCents > 0) {
      setLocalValue(fromCents(category.allocatedCents, minorUnits));
    }
  };

  const handleNameSubmit = () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === category.name) {
      setEditName(category.name);
      setNameError(undefined);
      setIsEditingName(false);
      return;
    }
    if (renameCategory(category.id, trimmed)) {
      setNameError(undefined);
      setIsEditingName(false);
    } else {
      setNameError(`"${trimmed}" already exists`);
    }
  };

  const pct = totalCents > 0 ? percentOf(category.allocatedCents, totalCents) : 0;
  const progress = Math.min(pct, 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          {dragHandle}
          <div
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: category.color ?? "#6b7280" }}
            aria-hidden
          />
          {isEditingName ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSubmit();
                if (e.key === "Escape") {
                  setEditName(category.name);
                  setNameError(undefined);
                  setIsEditingName(false);
                }
              }}
              className="h-8 w-32"
              aria-label={`Rename ${category.name}`}
              aria-invalid={!!nameError}
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="font-medium hover:underline text-left"
              aria-label={`Edit category name: ${category.name}`}
            >
              {category.name}
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => removeCategory(category.id)}
          aria-label={`Remove ${category.name}`}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        <div className="flex gap-2 items-center">
          <span className="text-muted-foreground">{symbol}</span>
          <Input
            type="text"
            inputMode="decimal"
            placeholder={minorUnits === 1 ? "0" : "0.00"}
            value={localValue}
            onChange={handleAmountChange}
            onFocus={handleAmountFocus}
            onBlur={handleAmountBlur}
            aria-label={`Allocation for ${category.name}`}
            className="font-mono"
          />
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={!!category.essential}
            onChange={() => toggleEssential(category.id)}
            className="h-3.5 w-3.5 accent-green-600"
          />
          Must-have (food, rent, transport…)
        </label>
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            {pct.toFixed(1)}% of total
            {category.allocatedCents > 0 && (
              <> · {formatCents(category.allocatedCents, currency)}</>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
