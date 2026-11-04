"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useBudgetStore } from "@/store/budget-store";
import { useMonthPlan } from "@/lib/use-month-plan";
import { formatCents, percentOf } from "@/lib/math-engine";

const FIXED_COLOR = "#64748b";
const GOALS_COLOR = "#14b8a6";
const LEFT_COLOR = "#d4d4d8";

export function AllocationChart() {
  const totalCents = useBudgetStore((s) => s.totalCents);
  const currency = useBudgetStore((s) => s.currency);
  const categories = useBudgetStore((s) => s.categories);
  const { plan, goalSavingsCents } = useMonthPlan();

  const data = React.useMemo(() => {
    const slices = [
      { id: "__fixed", name: "Loans & bills", value: plan.fixedCents, color: FIXED_COLOR },
      ...categories.map((c) => ({
        id: c.id,
        name: c.name,
        value: c.allocatedCents,
        color: c.color ?? "#6b7280",
      })),
      { id: "__goals", name: "Goal savings", value: goalSavingsCents, color: GOALS_COLOR },
    ];
    const used = slices.reduce((s, x) => s + x.value, 0);
    if (totalCents > used) {
      slices.push({ id: "__left", name: "Left for you", value: totalCents - used, color: LEFT_COLOR });
    }
    const base = Math.max(totalCents, used);
    return slices
      .filter((x) => x.value > 0)
      .map((x) => ({ ...x, percent: percentOf(x.value, base) }));
  }, [categories, totalCents, plan.fixedCents, goalSavingsCents]);

  if (totalCents === 0 || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border bg-muted/30 px-6">
        <p className="text-sm text-muted-foreground text-center max-w-[280px]">
          Add your monthly income to see where it goes
        </p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; percent: number } }> }) => {
    if (!active || !payload?.[0]) return null;
    const { name, value, percent } = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">
          {formatCents(value, currency)} ({percent.toFixed(1)}%)
        </p>
      </div>
    );
  };

  return (
    <div className="grid items-center gap-6 md:grid-cols-2">
      <div className="h-64 w-full" role="img" aria-label="Where your income goes">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm">
        {data.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span className="flex-1 truncate">{entry.name}</span>
            <span className="font-mono">{formatCents(entry.value, currency)}</span>
            <span className="w-14 text-right text-muted-foreground">
              {entry.percent.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
