"use client";

import * as React from "react";
import { useBudgetStore } from "@/store/budget-store";
import { isTab, useNav, type Tab } from "@/store/nav-store";
import { IncomeCard } from "@/components/budget/income-card";
import { AllocationChart } from "@/components/budget/allocation-chart";
import { MonthOverview } from "@/components/plan/month-overview";
import { ObligationsSection } from "@/components/plan/obligations-section";
import { CategoriesSection } from "@/components/plan/categories-section";
import { SafetyBufferCard } from "@/components/plan/safety-buffer-card";
import { GoalsSection } from "@/components/plan/goals-section";
import { AutoSplit } from "@/components/plan/auto-split";
import { CarryOverBanner } from "@/components/plan/carry-over-banner";
import { ExpenseDialog, ExpensesSection, useExpenseDialog } from "@/components/plan/expenses-section";
import { TrendsSection } from "@/components/plan/trends-section";
import {
  GetStartedCard,
  GoalsSnapshot,
  SpendingSnapshot,
  UpcomingPayments,
} from "@/components/overview/snapshots";
import { ExportDialog } from "@/components/export-dialog";
import { DataMenu } from "@/components/data-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { CurrencySelector } from "@/components/currency-selector";
import { MonthSwitcher } from "@/components/month-switcher";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  PiggyBank,
  Plus,
  Receipt,
  type LucideIcon,
} from "lucide-react";

const NAV: { tab: Tab; label: string; icon: LucideIcon }[] = [
  { tab: "overview", label: "Overview", icon: LayoutDashboard },
  { tab: "plan", label: "Plan", icon: ClipboardList },
  { tab: "spending", label: "Spending", icon: Receipt },
  { tab: "goals", label: "Goals", icon: PiggyBank },
  { tab: "trends", label: "Trends", icon: BarChart3 },
];

/** Same width and side padding everywhere: 16px on phones up to 32px on desktop. */
const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

function HydrationGuard({ children }: { children: React.ReactNode }) {
  const isHydrated = useBudgetStore((s) => s.isHydrated);
  const hydrate = useBudgetStore((s) => s.hydrate);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading your budget…</p>
      </div>
    );
  }

  return <>{children}</>;
}

/** Keep the open tab in the URL hash so refresh and the back button work. */
function useHashTab() {
  const tab = useNav((s) => s.tab);
  const setTab = useNav((s) => s.setTab);

  React.useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      setTab(isTab(h) ? h : "overview");
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("popstate", fromHash);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("popstate", fromHash);
    };
  }, [setTab]);

  React.useEffect(() => {
    const want = tab === "overview" ? "" : `#${tab}`;
    if (window.location.hash !== want) {
      history.pushState(null, "", want || window.location.pathname);
      window.scrollTo({ top: 0 });
    }
  }, [tab]);
}

function NavButtons({ variant }: { variant: "top" | "bottom" }) {
  const tab = useNav((s) => s.tab);
  const setTab = useNav((s) => s.setTab);
  return (
    <>
      {NAV.map(({ tab: t, label, icon: Icon }) => {
        const active = t === tab;
        return (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={active ? "page" : undefined}
            className={
              variant === "top"
                ? cn(
                    "relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )
                : cn(
                    "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                    active ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                  )
            }
          >
            <Icon className={variant === "top" ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
            {label}
            {variant === "top" && active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-green-600 dark:bg-green-400" />
            )}
          </button>
        );
      })}
    </>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function OverviewTab() {
  const budgetName = useBudgetStore((s) => s.budgetName);
  return (
    <div className="space-y-6">
      <PageTitle title={budgetName} subtitle="Your month at a glance" />
      <CarryOverBanner />
      <GetStartedCard />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <MonthOverview />
          <UpcomingPayments />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <SpendingSnapshot />
          <GoalsSnapshot />
        </div>
      </div>
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="mb-4 text-base font-semibold">Where your income goes</h3>
          <AllocationChart />
        </CardContent>
      </Card>
    </div>
  );
}

function PlanTab() {
  const budgetName = useBudgetStore((s) => s.budgetName);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Plan" subtitle={`Income, bills and categories for ${budgetName}`} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground md:hidden">
          Currency <CurrencySelector />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <IncomeCard />
        <SafetyBufferCard />
      </div>
      <ObligationsSection />
      <CategoriesSection />
    </div>
  );
}

function SpendingTab() {
  const budgetName = useBudgetStore((s) => s.budgetName);
  return (
    <div className="space-y-6">
      <PageTitle title="Spending" subtitle={`What you've spent in ${budgetName}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SpendingSnapshot showLink={false} title="By category" />
        </div>
        <div className="lg:col-span-2">
          <ExpensesSection />
        </div>
      </div>
    </div>
  );
}

function GoalsTab() {
  return (
    <div className="space-y-6">
      <PageTitle title="Goals" />
      <GoalsSection />
    </div>
  );
}

function TrendsTab() {
  const months = useBudgetStore((s) => s.monthlyBudgets.length);
  return (
    <div className="space-y-6">
      <PageTitle title="Trends" />
      {months < 2 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Trends appear once you have two or more months. Add next month from the month menu at
            the top.
          </CardContent>
        </Card>
      )}
      <TrendsSection />
    </div>
  );
}

export default function Home() {
  useHashTab();
  const tab = useNav((s) => s.tab);
  const openExpense = useExpenseDialog((s) => s.openNew);

  return (
    <HydrationGuard>
      {/* Bottom room on phones so content scrolls clear of the nav bar and + button. */}
      <div className="min-h-screen bg-background pb-40 sm:pb-0">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className={cn(CONTAINER, "flex h-14 items-center gap-2 sm:gap-4")}>
            <h1 className="shrink-0 text-lg font-bold tracking-tight sm:text-xl">
              A<span className="text-green-600 dark:text-green-400">ll</span>ocatify
            </h1>
            <div className="flex min-w-0 flex-1 justify-center sm:justify-start">
              <MonthSwitcher />
            </div>
            <div className="hidden md:block">
              <CurrencySelector />
            </div>
            <ThemeToggle />
            <DataMenu />
          </div>
          <nav aria-label="Sections" className={cn(CONTAINER, "hidden gap-1 sm:flex")}>
            <NavButtons variant="top" />
          </nav>
        </header>

        <main className={cn(CONTAINER, "py-6")}>
          <AutoSplit />
          {tab === "overview" && <OverviewTab />}
          {tab === "plan" && <PlanTab />}
          {tab === "spending" && <SpendingTab />}
          {tab === "goals" && <GoalsTab />}
          {tab === "trends" && <TrendsTab />}
        </main>

        <footer className={cn(CONTAINER, "border-t py-6 text-center text-xs text-muted-foreground")}>
          Zero sign-up · Your data never leaves your device
          <p className="mt-1 opacity-70">© 2026 Noemi. All lefts (and rights) reserved.</p>
        </footer>

        {/* Phones: quick add + bottom navigation */}
        <button
          type="button"
          onClick={() => openExpense()}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
          aria-label="Add expense"
        >
          <Plus className="h-6 w-6" />
        </button>
        <nav
          aria-label="Sections"
          className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        >
          <NavButtons variant="bottom" />
        </nav>

        <ExpenseDialog />
        <ExportDialog />
      </div>
    </HydrationGuard>
  );
}
