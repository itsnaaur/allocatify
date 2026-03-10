"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useBudgetStore } from "@/store/budget-store";
import { TEMPLATES } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { ChevronDown, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";

export function TemplateSelector() {
  const [open, setOpen] = React.useState(false);
  const activeTemplateId = useBudgetStore((s) => s.activeTemplateId);
  const applyTemplate = useBudgetStore((s) => s.applyTemplate);

  const activeTemplate = TEMPLATES.find((t) => t.id === activeTemplateId);
  const displayLabel = activeTemplate ? activeTemplate.name : "Templates";

  const handleSelect = (templateId: string) => {
    const t = TEMPLATES.find((x) => x.id === templateId);
    if (t) {
      applyTemplate(t);
      setOpen(false);
    }
  };

  return (
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
  );
}
