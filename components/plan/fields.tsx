"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { CURRENCIES, type CurrencyCode } from "@/lib/currencies";
import { fromCents, sanitizeAmountInput, toCents } from "@/lib/math-engine";
import { cn } from "@/lib/utils";

/** Text field for money: only digits and one decimal point can be typed. */
export function MoneyField({
  id,
  label,
  hint,
  currency,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  hint?: string;
  currency: CurrencyCode;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const cfg = CURRENCIES[currency];
  const decimals = cfg.minorUnitsPerMajor === 1 ? 0 : 2;
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-8 shrink-0 text-right">{cfg.symbol}</span>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          placeholder={decimals ? "0.00" : "0"}
          value={value}
          onChange={(e) => onChange(sanitizeAmountInput(e.target.value, decimals))}
          aria-invalid={!!error}
          aria-describedby={hint || error ? `${id}-hint` : undefined}
          className="font-mono"
        />
      </div>
    </Field>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {(error || hint) && (
        <p
          id={`${id}-hint`}
          className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export const selectClass =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function moneyToCents(value: string, currency: CurrencyCode): number {
  return toCents(value || "0", CURRENCIES[currency].minorUnitsPerMajor);
}

export function centsToMoney(cents: number | undefined, currency: CurrencyCode): string {
  if (!cents) return "";
  return fromCents(cents, CURRENCIES[currency].minorUnitsPerMajor);
}
