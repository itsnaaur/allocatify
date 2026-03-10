"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useBudgetStore } from "@/store/budget-store";
import { CURRENCIES, type CurrencyCode } from "@/lib/currencies";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const CURRENCY_LIST: CurrencyCode[] = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "INR", "CHF", "PHP"];

export function CurrencySelector() {
  const [open, setOpen] = React.useState(false);
  const currency = useBudgetStore((s) => s.currency);
  const setCurrency = useBudgetStore((s) => s.setCurrency);
  const cfg = CURRENCIES[currency];

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Currency: ${cfg.name}. Choose currency`}
        >
          <span className="text-base font-medium" aria-hidden="true">{cfg.symbol}</span>
          <span className="font-medium">{cfg.code}</span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        className="min-w-[180px] rounded-lg border bg-card p-1 shadow-md z-50"
        align="end"
        role="listbox"
      >
        {CURRENCY_LIST.map((code) => (
          <DropdownMenu.Item
            key={code}
            onSelect={() => {
              setCurrency(code);
              setOpen(false);
            }}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer outline-none hover:bg-accent focus:bg-accent",
              currency === code && "bg-accent"
            )}
            role="option"
            aria-selected={currency === code}
          >
            <span className="font-medium">{CURRENCIES[code].symbol}</span>
            <span>{code}</span>
            <span className="text-muted-foreground text-xs">— {CURRENCIES[code].name}</span>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
