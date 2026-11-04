"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useBudgetStore } from "@/store/budget-store";
import { TEMPLATES, type BudgetTemplate } from "@/lib/templates";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronDown, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";

export function TemplateSelector() {
  const [open, setOpen] = React.useState(false);
  const activeTemplateId = useBudgetStore((s) => s.activeTemplateId);
  const applyTemplate = useBudgetStore((s) => s.applyTemplate);
  const categories = useBudgetStore((s) => s.categories);
  const autoScale = useBudgetStore((s) => s.autoScale);
  const [pending, setPending] = React.useState<BudgetTemplate | null>(null);

  const activeTemplate = TEMPLATES.find((t) => t.id === activeTemplateId);
  const displayLabel = activeTemplate ? activeTemplate.name : "Templates";

  const handleSelect = (templateId: string) => {
    const t = TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setOpen(false);
    // Hand-edited categories would be lost: ask first.
    const hasOwnWork = !autoScale && categories.length > 0;
    if (hasOwnWork) setPending(t);
    else applyTemplate(t);
  };

  return (
    <>
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Template: ${displayLabel}. Choose a budget template`}
        >
          <LayoutTemplate className="h-4 w-4" />
          {displayLabel}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
          className="min-w-[260px] rounded-lg border bg-card p-1 shadow-md z-50"
          align="start"
          role="listbox"
        >
          {TEMPLATES.map((t) => (
            <DropdownMenu.Item
              key={t.id}
              onSelect={() => handleSelect(t.id)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-md px-3 py-2 cursor-pointer outline-none hover:bg-accent focus:bg-accent",
                activeTemplateId === t.id && "bg-accent"
              )}
              role="option"
              aria-selected={activeTemplateId === t.id}
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-muted-foreground">
                {t.description}
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
    </DropdownMenu.Root>
    <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Switch to {pending?.name}?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {pending?.categories.length
              ? `Your ${categories.length} spending ${categories.length === 1 ? "category" : "categories"} and their amounts will be replaced by this template's split.`
              : `All ${categories.length} spending ${categories.length === 1 ? "category" : "categories"} will be removed so you can start from scratch.`}{" "}
            Loans, bills and goals are not affected.
          </p>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Keep mine</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              if (pending) applyTemplate(pending);
              setPending(null);
            }}
          >
            Replace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
