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
  budget: BudgetSchema;
  currency?: CurrencyCode;
  generatedAt: string;
}

export function PDFReport({ budget, currency = "USD", generatedAt }: PDFReportProps) {
  const total = budget.totalCents;
  const allocated = budget.categories.reduce((s, c) => s + c.allocatedCents, 0);
  const remaining = total - allocated;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{budget.name || "Allocatify Budget"}</Text>
        <Text style={styles.subtitle}>
          Generated {generatedAt} · Privacy-first, no data leaves your device
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total Budget</Text>
            <Text style={styles.rowValue}>{formatCentsPlain(total, currency)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Allocated</Text>
            <Text style={styles.rowValue}>{formatCentsPlain(allocated, currency)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Remaining</Text>
            <Text style={styles.rowValue}>{formatCentsPlain(remaining, currency)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          {budget.categories.map((c) => (
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
