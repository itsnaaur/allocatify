/**
 * Import utilities: Parse CSV from banks and map to template.
 * Handles unexpected formats with flexible column detection.
 */

export interface ParsedCSVRow {
  [key: string]: string;
}

/**
 * Parse CSV string into rows of key-value objects.
 * Tries to detect header row and numeric columns.
 */
export function parseCSV(content: string): ParsedCSVRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === "," && !inQuotes) || (c === "\t" && !inQuotes)) {
        result.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headerRow = parseRow(lines[0]);
  const rows: ParsedCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row: ParsedCSVRow = {};
    headerRow.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Find the best numeric column for "amount" from parsed rows.
 * Common bank column names: Amount, Debit, Credit, Total, etc.
 */
const AMOUNT_COLUMN_HINTS = [
  "amount",
  "debit",
  "credit",
  "total",
  "sum",
  "value",
  "balance",
  "transaction amount",
];

export function detectAmountColumn(rows: ParsedCSVRow[]): string | null {
  if (rows.length === 0) return null;
  const headers = Object.keys(rows[0]).map((h) => h.toLowerCase());
  for (const hint of AMOUNT_COLUMN_HINTS) {
    const found = headers.find((h) => h.includes(hint));
    if (found) {
      const original = Object.keys(rows[0]).find(
        (k) => k.toLowerCase() === found
      );
      return original ?? null;
    }
  }
  // Fallback: first column that looks numeric
  for (const header of Object.keys(rows[0])) {
    const sample = rows[0][header];
    if (sample && /^-?[\d,]+\.?\d*$/.test(String(sample).replace(/,/g, ""))) {
      return header;
    }
  }
  return null;
}

/**
 * Extract numeric value from a cell (handles $1,234.56, -123, etc.)
 * Converts to minor units (cents, yen, etc.) based on minorUnitsPerMajor.
 */
export function parseAmount(value: string, minorUnitsPerMajor: number = 100): number {
  const cleaned = String(value).replace(/[$,€£¥₹₱]/g, "").replace(/,/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n * minorUnitsPerMajor);
}
