"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useBudgetStore } from "@/store/budget-store";
import { usePlannerStore } from "@/store/planner-store";
import { useTheme } from "@/components/theme-provider";
import { buildTrends, type TrendPoint } from "@/lib/trends";
import { formatCents } from "@/lib/math-engine";
import type { BudgetSchema } from "@/lib/schema-validator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Table2 } from "lucide-react";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${SHORT[m - 1]} ${String(y).slice(2)}`;
};

// Validated categorical palette (fixed order), light and dark steps.
const SERIES = [
  { key: "fixedCents", name: "Loans & bills", light: "#2a78d6", dark: "#3987e5" },
  { key: "spendingCents", name: "Spending", light: "#eb6834", dark: "#d95926" },
  { key: "savedCents", name: "Goal savings", light: "#1baf7a", dark: "#199e70" },
  { key: "leftCents", name: "Left over", light: "#eda100", dark: "#c98500" },
] as const;

/** Where each month's income went, and loan balances over time. */
export function TrendsSection() {
  const currency = useBudgetStore((s) => s.currency);
  const monthlyBudgets = useBudgetStore((s) => s.monthlyBudgets);
  const live = useBudgetStore();
  const { obligations, payments, goals, contributions, expenses } = usePlannerStore();
  const { resolvedTheme } = useTheme();
  const [showTable, setShowTable] = React.useState(false);
  const dark = resolvedTheme === "dark";

  const points = React.useMemo(() => {
    // Use the month on screen as it is now (edits may not be saved yet).
    const budgets: BudgetSchema[] = monthlyBudgets.map((b) =>
      (b.monthKey ?? b.id) === live.monthKey
        ? {
            ...b,
            totalCents: live.totalCents,
            incomeSources: live.incomeSources,
            categories: live.categories,
            carryInCents: live.carryInCents,
            carryOutCents: live.carryOutCents,
          }
        : b
    );
    return buildTrends(budgets, { obligations, payments, goals, contributions, expenses });
  }, [monthlyBudgets, live, obligations, payments, goals, contributions, expenses]);

  if (points.length < 2) return null;

  const fmt = (c: number) => formatCents(c, currency);
  const surface = dark ? "#0c1322" : "#ffffff";
  const ink = dark ? "#94a3b8" : "#64748b";
  const grid = dark ? "#1e293b" : "#e2e8f0";
  const debtPoints = points.filter((p) => p.debtCents !== null) as (TrendPoint & { debtCents: number })[];
  const hasDebt = debtPoints.length > 0;
  const avgSaved = Math.round(points.reduce((s, p) => s + p.savedCents, 0) / points.length);
  const debtDown = hasDebt ? debtPoints[0].debtCents - debtPoints[debtPoints.length - 1].debtCents : 0;
  const data = points.map((p) => ({ ...p, label: label(p.monthKey) }));
  const axisMoney = (v: number) =>
    formatCents(v, currency).replace(/\.00$/, "").replace(/(\d)(\d{3}),000$/, "$1$2k");

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-semibold">Trends</h3>
          <p className="text-sm text-muted-foreground">
            Last {points.length} months · where each month&apos;s income went
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
        >
          {showTable ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
          {showTable ? "Show chart" : "Show table"}
        </Button>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Saved for goals, per month</p>
            <p className="text-2xl font-bold">{fmt(avgSaved)}</p>
            <p className="text-xs text-muted-foreground">average over {points.length} months</p>
          </CardContent>
        </Card>
        {hasDebt && (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">Loans paid down</p>
              <p className="text-2xl font-bold">{fmt(Math.max(0, debtDown))}</p>
              <p className="text-xs text-muted-foreground">
                {fmt(debtPoints[debtPoints.length - 1].debtCents)} still owed
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="py-4">
          {showTable ? (
            <TrendsTable points={points} fmt={fmt} />
          ) : (
            <>
              <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Legend">
                {SERIES.map((s) => (
                  <li key={s.key} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: dark ? s.dark : s.light }}
                      aria-hidden
                    />
                    {s.name}
                  </li>
                ))}
              </ul>
              <div
                className="h-64"
                role="img"
                aria-label="Stacked bars per month: loans and bills, spending, goal savings and left over. Use Show table for the numbers."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke={grid} />
                    <XAxis dataKey="label" tick={{ fill: ink, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={axisMoney}
                      tick={{ fill: ink, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip
                      cursor={{ fill: dark ? "rgba(148,163,184,0.08)" : "rgba(100,116,139,0.08)" }}
                      content={<MonthTooltip fmt={fmt} />}
                    />
                    {SERIES.map((s, i) => (
                      <Bar
                        key={s.key}
                        dataKey={s.key}
                        name={s.name}
                        stackId="income"
                        fill={dark ? s.dark : s.light}
                        stroke={surface}
                        strokeWidth={2}
                        radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {hasDebt && (
                <>
                  <p className="mt-6 mb-2 text-sm font-medium">Still owed on loans</p>
                  <div className="h-40" role="img" aria-label="Line: total still owed on loans each month">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} stroke={grid} />
                        <XAxis dataKey="label" tick={{ fill: ink, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tickFormatter={axisMoney}
                          tick={{ fill: ink, fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          width={64}
                        />
                        <Tooltip
                          formatter={(v: number) => [fmt(v), "Still owed"]}
                          contentStyle={{ background: surface, border: `1px solid ${grid}`, borderRadius: 8 }}
                          labelStyle={{ color: ink }}
                          itemStyle={{ color: dark ? "#f1f5f9" : "#0f172a" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="debtCents"
                          stroke={dark ? "#3987e5" : "#2a78d6"}
                          strokeWidth={2}
                          dot={{ r: 4, strokeWidth: 2, stroke: surface }}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function MonthTooltip({
  active,
  payload,
  fmt,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint & { label: string } }[];
  fmt: (c: number) => string;
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium">{p.label}</p>
      <p className="text-muted-foreground">Income {fmt(p.incomeCents)}</p>
      {SERIES.map((s) => (
        <p key={s.key}>
          {s.name}: {fmt(p[s.key])}
        </p>
      ))}
      {p.overspentCents > 0 && <p className="text-destructive">Overspent {fmt(p.overspentCents)}</p>}
      {!p.tracked && <p className="text-xs text-muted-foreground">No expenses logged: planned amounts</p>}
    </div>
  );
}

function TrendsTable({ points, fmt }: { points: TrendPoint[]; fmt: (c: number) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 font-medium">Month</th>
            <th className="py-2 pr-3 text-right font-medium">Income</th>
            {SERIES.map((s) => (
              <th key={s.key} className="py-2 pr-3 text-right font-medium">
                {s.name}
              </th>
            ))}
            <th className="py-2 text-right font-medium">Still owed</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.monthKey} className="border-t">
              <td className="py-2 pr-3">{label(p.monthKey)}</td>
              <td className="py-2 pr-3 text-right font-mono">{fmt(p.incomeCents)}</td>
              {SERIES.map((s) => (
                <td key={s.key} className="py-2 pr-3 text-right font-mono">
                  {fmt(p[s.key])}
                </td>
              ))}
              <td className="py-2 text-right font-mono">
                {p.debtCents === null ? "—" : fmt(p.debtCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        Spending uses logged expenses where you tracked them, planned amounts where you didn&apos;t.
      </p>
    </div>
  );
}
