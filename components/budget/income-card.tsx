"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { formatCents, fromCents, sanitizeAmountInput, toCents } from "@/lib/math-engine";
import { CURRENCIES } from "@/lib/currencies";
import type { IncomeSource } from "@/lib/schema-validator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

const ordinal = (d: number) =>
  `${d}${d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th"}`;

/** Monthly income: one or more sources (salary, freelance…), each with an optional pay day. */
export function IncomeCard() {
  const currency = useBudgetStore((s) => s.currency);
  const totalCents = useBudgetStore((s) => s.totalCents);
  const sources = useBudgetStore((s) => s.incomeSources);
  const addIncomeSource = useBudgetStore((s) => s.addIncomeSource);
  const many = sources.length > 1;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle id="income-label">Monthly income</CardTitle>
        <p className="text-sm text-muted-foreground">After tax, for this month</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.map((src) => (
          <IncomeRow key={src.id} source={src} compact={!many} />
        ))}
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => addIncomeSource()}>
          <Plus className="h-4 w-4" />
          Add income source
        </Button>
        {many && (
          <p className="border-t pt-2 text-sm">
            Total <span className="font-semibold">{formatCents(totalCents, currency)}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function IncomeRow({ source, compact }: { source: IncomeSource; compact: boolean }) {
  const currency = useBudgetStore((s) => s.currency);
  const update = useBudgetStore((s) => s.updateIncomeSource);
  const remove = useBudgetStore((s) => s.removeIncomeSource);
  const minor = CURRENCIES[currency].minorUnitsPerMajor;
  const decimals = minor === 1 ? 0 : 2;
  const [value, setValue] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [name, setName] = React.useState(source.name);

  // Show the stored amount unless the user is typing (template change, restore…).
  React.useEffect(() => {
    if (!focused) setValue(source.amountCents ? fromCents(source.amountCents, minor) : "");
  }, [source.amountCents, minor, focused]);
  React.useEffect(() => setName(source.name), [source.name]);

  const amountId = `income-${source.id}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const n = name.trim();
            if (n && n !== source.name) update(source.id, { name: n });
            else setName(source.name);
          }}
          aria-label="Income name"
          className="h-8 flex-1 border-transparent bg-transparent px-1 text-sm font-medium hover:border-input focus:border-input"
          maxLength={60}
        />
        <select
          value={source.payDay ?? ""}
          onChange={(e) =>
            update(source.id, { payDay: e.target.value ? Number(e.target.value) : undefined })
          }
          aria-label={`Pay day for ${source.name}`}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
        >
          <option value="">Pay day</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              Paid on the {ordinal(d)}
            </option>
          ))}
        </select>
        {!compact && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => remove(source.id)}
            aria-label={`Remove ${source.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Input
        id={amountId}
        type="text"
        inputMode="decimal"
        placeholder={decimals ? "0.00" : "0"}
        value={value}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          const v = sanitizeAmountInput(e.target.value, decimals);
          setValue(v);
          update(source.id, { amountCents: toCents(v || "0", minor) });
        }}
        onBlur={() => {
          setFocused(false);
          if (source.amountCents) setValue(fromCents(source.amountCents, minor));
        }}
        aria-label={`Amount for ${source.name}`}
        aria-describedby="income-label"
        className={compact ? "text-2xl font-semibold" : "font-mono"}
      />
    </div>
  );
}
