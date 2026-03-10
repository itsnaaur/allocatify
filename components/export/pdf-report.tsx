"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { BudgetSchema } from "@/lib/schema-validator";
import { formatCentsPlain, percentOf } from "@/lib/math-engine";
import type { CurrencyCode } from "@/lib/currencies";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 24,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowLabel: {
    fontSize: 12,
  },
  rowLabelBold: {
    fontSize: 12,
    fontWeight: "bold",
  },
  rowValue: {
    fontSize: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 8,
    fontSize: 14,
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 10,
    color: "#999",
    textAlign: "center",
  },
});

interface PDFReportProps {
  budget?: BudgetSchema;
  budgets?: BudgetSchema[];
  currency?: CurrencyCode;
  generatedAt: string;
}

/** Multi-month year layout: each month as a section. */
function YearMonthSection({ budget, currency }: { budget: BudgetSchema; currency: CurrencyCode }) {
  const total = budget.totalCents;
  const allocated = budget.categories.reduce((s, c) => s + c.allocatedCents, 0);
  const remaining = total - allocated;

  return (
    <>
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{budget.name}</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabelBold}>Total Budget</Text>
        <Text style={styles.rowValue}>{formatCentsPlain(total, currency)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabelBold}>Allocated</Text>
        <Text style={styles.rowValue}>{formatCentsPlain(allocated, currency)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabelBold}>Remaining</Text>
        <Text style={styles.rowValue}>{formatCentsPlain(remaining, currency)}</Text>
      </View>
      {budget.categories.map((c) => (
        <View key={c.id} style={styles.row}>
          <Text style={styles.rowLabel}>  {c.name}</Text>
          <Text style={styles.rowValue}>
            {formatCentsPlain(c.allocatedCents, currency)} (
            {percentOf(c.allocatedCents, total).toFixed(1)}%)
          </Text>
        </View>
      ))}
    </>
  );
}

export function PDFReport({ budget, budgets, currency = "USD", generatedAt }: PDFReportProps) {
  const isYearReport = budgets && budgets.length > 1;
  const year = budgets?.[0]?.monthKey?.slice(0, 4);

  if (isYearReport && budgets) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>{year ? `${year} Year Report` : "Year Report"}</Text>
          <Text style={styles.subtitle}>
            Generated {generatedAt} · Privacy-first, no data leaves your device
          </Text>
          <View style={styles.section}>
            {budgets.map((b) => (
              <YearMonthSection key={b.id} budget={b} currency={currency} />
            ))}
          </View>
          <Text style={styles.footer}>
            Allocatify — A Privacy-First Financial Allocation Engine. Your data
            never leaves your device.
          </Text>
        </Page>
      </Document>
    );
  }

  const b = budget ?? budgets?.[0];
  if (!b) return null;

  const total = b.totalCents;
  const allocated = b.categories.reduce((s, c) => s + c.allocatedCents, 0);
  const remaining = total - allocated;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{b.name || "Allocatify Budget"}</Text>
        <Text style={styles.subtitle}>
          Generated {generatedAt} · Privacy-first, no data leaves your device
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabelBold}>Total Budget</Text>
            <Text style={styles.rowValue}>{formatCentsPlain(total, currency)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabelBold}>Allocated</Text>
            <Text style={styles.rowValue}>{formatCentsPlain(allocated, currency)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabelBold}>Remaining</Text>
            <Text style={styles.rowValue}>{formatCentsPlain(remaining, currency)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          {b.categories.map((c) => (
            <View key={c.id} style={styles.row}>
              <Text style={styles.rowLabel}>{c.name}</Text>
              <Text style={styles.rowValue}>
                {formatCentsPlain(c.allocatedCents, currency)} (
                {percentOf(c.allocatedCents, total).toFixed(1)}%)
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Allocatify — A Privacy-First Financial Allocation Engine. Your data
          never leaves your device.
        </Text>
      </Page>
    </Document>
  );
}
