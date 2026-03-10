"use client";

import { useBudgetStore } from "@/store/budget-store";
import type { CurrencyCode } from "@/lib/currencies";
import { addCents, subtractCents, formatCents } from "@/lib/math-engine";
import { Card, CardContent } from "@/components/ui/card";

export function AllocationSummary() {
  const totalCents = useBudgetStore((s) => s.totalCents);
  const currency = useBudgetStore((s) => s.currency) as CurrencyCode;
  const categories = useBudgetStore((s) => s.categories);

  const allocatedCents = categories.reduce(
    (sum, c) => addCents(sum, c.allocatedCents),
    0
  );
  const remainingCents = subtractCents(totalCents, allocatedCents);
  const isOver = remainingCents < 0;
  const isBalanced = remainingCents === 0;

  if (totalCents === 0) return null;

  return (
    <Card
      className={
        isOver
          ? "border-destructive bg-destructive/5"
          : isBalanced
            ? "border-green-500/50 bg-green-500/5"
            : ""
      }
    >
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {isOver ? "Over budget by" : isBalanced ? "Balanced" : "Remaining"}
            </p>
            <p
              className={`text-2xl font-bold ${
                isOver
                  ? "text-destructive"
                  : isBalanced
                    ? "text-green-600 dark:text-green-400"
                    : "text-foreground"
              }`}
            >
              {isOver
                ? formatCents(-remainingCents, currency)
                : formatCents(remainingCents, currency)}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Allocated: {formatCents(allocatedCents, currency)}</p>
            <p>Total: {formatCents(totalCents, currency)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
