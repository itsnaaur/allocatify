"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useBudgetStore } from "@/store/budget-store";
import { formatCents, percentOf } from "@/lib/math-engine";

export function AllocationChart() {
  const totalCents = useBudgetStore((s) => s.totalCents);
  const currency = useBudgetStore((s) => s.currency);
  const categories = useBudgetStore((s) => s.categories);

  const data = React.useMemo(() => {
    return categories
      .filter((c) => c.allocatedCents > 0)
      .map((c) => ({
        name: c.name,
        value: c.allocatedCents,
        color: c.color ?? "#6b7280",
        percent: percentOf(c.allocatedCents, totalCents),
      }));
  }, [categories, totalCents]);

  if (totalCents === 0 || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Add a total budget and allocate to categories to see the chart
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
    <div className="h-64 w-full" role="img" aria-label="Allocation pie chart">
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
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
