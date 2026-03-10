"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useBudgetStore } from "@/store/budget-store";
import { formatMonthKey, getMonthKey, getNextMonthKey, getUpcomingMonthKeys } from "@/lib/month-utils";
import { Button } from "@/components/ui/button";
import { ChevronDown, CalendarPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function MonthSwitcher() {
  const [open, setOpen] = React.useState(false);
  const monthKey = useBudgetStore((s) => s.monthKey);
  const budgetName = useBudgetStore((s) => s.budgetName);
  const monthlyBudgets = useBudgetStore((s) => s.monthlyBudgets);
  const switchToMonth = useBudgetStore((s) => s.switchToMonth);
  const createNewMonth = useBudgetStore((s) => s.createNewMonth);
  const deleteMonth = useBudgetStore((s) => s.deleteMonth);

  const handleSwitch = (key: string) => {
    switchToMonth(key);
    setOpen(false);
  };

  const handleNewMonth = (key: string) => {
    createNewMonth(key, true);
    setOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    if (typeof window !== "undefined" && confirm(`Delete allocation for ${formatMonthKey(key)}?`)) {
      deleteMonth(key);
    }
  };

  const baseMonth = monthKey ?? getMonthKey(new Date());
  const upcomingMonths = getUpcomingMonthKeys(getNextMonthKey(baseMonth), 6);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Current month: ${budgetName}. Switch or add month`}
        >
          <span className="font-medium">{budgetName || "Select month"}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        className="min-w-[220px] rounded-lg border bg-card p-1 shadow-md z-50"
        align="start"
        role="listbox"
      >
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b mb-1">
          Saved months
        </div>
        {monthlyBudgets.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            No months yet. Add one below.
          </div>
        ) : (
          monthlyBudgets.map((b) => {
            const key = b.monthKey ?? b.id;
            return (
              <DropdownMenu.Item
                key={key}
                onSelect={() => handleSwitch(key)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-3 py-2 cursor-pointer outline-none hover:bg-accent focus:bg-accent group",
                  monthKey === key && "bg-accent"
                )}
                role="option"
                aria-selected={monthKey === key}
              >
                <span>{b.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDelete(e, key)}
                  aria-label={`Delete ${b.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenu.Item>
            );
          })
        )}

        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-t mt-1">
          Add new month
        </div>
        {upcomingMonths.map((key) => {
          const exists = monthlyBudgets.some((b) => (b.monthKey ?? b.id) === key);
          return (
            <DropdownMenu.Item
              key={key}
              onSelect={() => handleNewMonth(key)}
              className="flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
              role="option"
            >
              <CalendarPlus className="h-4 w-4 text-muted-foreground" />
              <span>{formatMonthKey(key)}</span>
              {exists && (
                <span className="text-xs text-muted-foreground ml-auto">(edit)</span>
              )}
            </DropdownMenu.Item>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
