"use client";

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatCentsPlain } from "@/lib/math-engine";
import { formatMonthKey } from "@/lib/month-utils";
import type { CurrencyCode } from "@/lib/currencies";
import type { MonthReport } from "@/lib/report";

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 56, fontFamily: "Helvetica", fontSize: 10, color: "#111" },
  title: { fontSize: 20, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: "#666", marginBottom: 16 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999", paddingBottom: 3, color: "#555" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  strong: { fontFamily: "Helvetica-Bold" },
  muted: { color: "#777" },
  over: { color: "#b91c1c" },
  colName: { flex: 3 },
  col: { flex: 2, textAlign: "right" },
  colWide: { flex: 4, textAlign: "right" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#999", textAlign: "center" },
});

function Month({ r, currency }: { r: MonthReport; currency: CurrencyCode }) {
  const m = (c: number | null | undefined) => (c === null || c === undefined ? "—" : formatCentsPlain(c, currency));
  const t = r.totals;
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        {[
          ["Income", r.incomeCents + r.carryInCents],
          ["Loans & bills", t.fixedDueCents],
          ["Spending (logged, or planned where not logged)", t.countedSpendingCents],
          ["Goal savings", t.goalSavedCents],
          ...(r.carryOutCents > 0 ? ([["Moved to next month", r.carryOutCents]] as [string, number][]) : []),
        ].map(([label, value]) => (
          <View key={label as string} style={styles.summaryRow}>
            <Text>{label}</Text>
            <Text>{m(value as number)}</Text>
          </View>
        ))}
        <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: "#999", marginTop: 3, paddingTop: 4 }]}>
          <Text style={styles.strong}>Left over</Text>
          <Text style={styles.strong}>{m(t.leftCents)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Income</Text>
        {r.incomeSources.map((s, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.colName}>{s.name}</Text>
            <Text style={styles.col}>{m(s.amountCents)}</Text>
          </View>
        ))}
        {r.carryInCents > 0 && (
          <View style={styles.row}>
            <Text style={styles.colName}>
              Carried over{r.carryInFrom ? ` from ${formatMonthKey(r.carryInFrom)}` : ""}
            </Text>
            <Text style={styles.col}>{m(r.carryInCents)}</Text>
          </View>
        )}
      </View>

      {r.fixed.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Loans &amp; bills</Text>
          <View style={styles.head}>
            <Text style={styles.colName}>Name</Text>
            <Text style={styles.col}>Due</Text>
            <Text style={styles.col}>Paid</Text>
            <Text style={styles.colWide}>Left to pay</Text>
          </View>
          {r.fixed.map((f, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <Text style={styles.colName}>
                {f.name} <Text style={styles.muted}>(day {f.dueDay})</Text>
              </Text>
              <Text style={styles.col}>{m(f.dueCents)}</Text>
              <Text style={styles.col}>{f.paidCents === null ? "Not paid" : m(f.paidCents)}</Text>
              <Text style={styles.colWide}>
                {f.kind === "loan" ? `${m(f.remainingCents)} · ${f.monthsLeft} mo` : "Monthly bill"}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spending</Text>
        <View style={styles.head}>
          <Text style={styles.colName}>Category</Text>
          <Text style={styles.col}>Planned</Text>
          <Text style={styles.col}>Spent</Text>
          <Text style={styles.colWide}>Left</Text>
        </View>
        {r.categories.map((c, i) => {
          const over = c.spentCents !== null && c.spentCents > c.plannedCents;
          return (
            <View key={i} style={styles.row} wrap={false}>
              <Text style={styles.colName}>
                {c.name}
                {c.essential ? <Text style={styles.muted}> · must-have</Text> : null}
              </Text>
              <Text style={styles.col}>{m(c.plannedCents)}</Text>
              <Text style={styles.col}>{c.spentCents === null ? "not logged" : m(c.spentCents)}</Text>
              <Text style={over ? [styles.colWide, styles.over] : styles.colWide}>
                {c.spentCents === null
                  ? "—"
                  : over
                    ? `${m(c.spentCents - c.plannedCents)} over`
                    : m(c.plannedCents - c.spentCents)}
              </Text>
            </View>
          );
        })}
        {r.uncategorizedSpentCents > 0 && (
          <View style={styles.row}>
            <Text style={styles.colName}>Uncategorized</Text>
            <Text style={styles.col}>—</Text>
            <Text style={styles.col}>{m(r.uncategorizedSpentCents)}</Text>
            <Text style={styles.colWide}>—</Text>
          </View>
        )}
      </View>

      {r.goals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Savings goals</Text>
          <View style={styles.head}>
            <Text style={styles.colName}>Goal</Text>
            <Text style={styles.col}>This month</Text>
            <Text style={styles.colWide}>Saved so far</Text>
          </View>
          {r.goals.map((g, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <Text style={styles.colName}>{g.name}</Text>
              <Text style={styles.col}>{m(g.savedThisMonthCents)}</Text>
              <Text style={styles.colWide}>
                {m(g.savedToDateCents)} of {m(g.targetCents)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expenses</Text>
        {r.expenses.length === 0 ? (
          <Text style={styles.muted}>No expenses logged.</Text>
        ) : (
          <>
            <View style={styles.head}>
              <Text style={{ flex: 2 }}>Date</Text>
              <Text style={{ flex: 4 }}>Description</Text>
              <Text style={{ flex: 3 }}>Category</Text>
              <Text style={styles.col}>Amount</Text>
            </View>
            {r.expenses.map((e, i) => (
              <View key={i} style={styles.row} wrap={false}>
                <Text style={{ flex: 2 }}>{e.date}</Text>
                <Text style={{ flex: 4 }}>{e.description}</Text>
                <Text style={{ flex: 3 }}>{e.category}</Text>
                <Text style={styles.col}>{m(e.amountCents)}</Text>
              </View>
            ))}
          </>
        )}
      </View>
    </>
  );
}

/** One page (or more) per month. */
export function PDFReport({
  reports,
  currency = "USD",
  generatedAt,
}: {
  reports: MonthReport[];
  currency?: CurrencyCode;
  generatedAt: string;
}) {
  return (
    <Document title="Allocatify report">
      {reports.map((r) => (
        <Page key={r.monthKey} size="A4" style={styles.page} wrap>
          <Text style={styles.title}>{r.name}</Text>
          <Text style={styles.subtitle}>Generated {generatedAt} · Allocatify</Text>
          <Month r={r} currency={currency} />
          <Text
            style={styles.footer}
            fixed
            render={({ pageNumber, totalPages }) =>
              `Allocatify — your data stays on your device · Page ${pageNumber} of ${totalPages}`
            }
          />
        </Page>
      ))}
    </Document>
  );
}
