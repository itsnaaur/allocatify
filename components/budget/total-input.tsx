"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { toCents, formatCents, fromCents } from "@/lib/math-engine";
import { CURRENCIES } from "@/lib/currencies";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TotalInput() {
  const totalCents = useBudgetStore((s) => s.totalCents);
  const currency = useBudgetStore((s) => s.currency);
  const setTotal = useBudgetStore((s) => s.setTotal);
  const [localValue, setLocalValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const minorUnits = CURRENCIES[currency].minorUnitsPerMajor;

  // Only sync from store when NOT focused (e.g. template change, import, reset)
  React.useEffect(() => {
    if (!isFocused) {
      setLocalValue(totalCents === 0 ? "" : fromCents(totalCents, minorUnits));
    }
  }, [totalCents, minorUnits, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    setTotal(toCents(v, minorUnits));
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Format on blur: add decimals if needed (e.g. 200 -> 200.00)
    if (totalCents > 0) {
      setLocalValue(fromCents(totalCents, minorUnits));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle id="total-budget-label">Total Budget</CardTitle>
      </CardHeader>
      <CardContent>
        <Label htmlFor="total-input" className="sr-only">
          Enter your total monthly budget
        </Label>
        <Input
          id="total-input"
          type="text"
          inputMode="decimal"
          placeholder={minorUnits === 1 ? "0" : "0.00"}
          value={localValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          aria-labelledby="total-budget-label"
          aria-describedby="total-budget-hint"
          className="text-2xl font-semibold"
        />
        <p id="total-budget-hint" className="mt-2 text-sm text-muted-foreground">
          {totalCents > 0 ? formatCents(totalCents, currency) : "Enter your monthly income"}
        </p>
      </CardContent>
    </Card>
  );
}
