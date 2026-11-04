/**
 * Math Engine: Handles currency calculations without floating-point errors.
 * All amounts are stored in minor units (e.g. cents for USD, yen for JPY).
 */

import type { CurrencyCode } from "./currencies";
import { CURRENCIES } from "./currencies";

const DEFAULT_MINOR_UNITS = 100;

/**
 * Convert a main-unit amount (number or string) to minor units.
 * Handles "1,234.56" and "1234.56" formats. For JPY, decimals are ignored.
 */
export function toCents(
  value: number | string,
  minorUnitsPerMajor: number = DEFAULT_MINOR_UNITS
): number {
  if (typeof value === "number") {
    return Math.round(value * minorUnitsPerMajor);
  }
  const cleaned = String(value).replace(/,/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * minorUnitsPerMajor);
}

/**
 * Convert minor units to a display-ready string (no symbol).
 */
export function fromCents(
  cents: number,
  minorUnitsPerMajor: number = DEFAULT_MINOR_UNITS
): string {
  const decimals = minorUnitsPerMajor === 1 ? 0 : 2;
  return (cents / minorUnitsPerMajor).toFixed(decimals);
}

/**
 * Format minor units as a currency string (e.g., "$1,234.56", "¥10,000").
 */
export function formatCents(cents: number, currency: CurrencyCode = "USD"): string {
  const cfg = CURRENCIES[currency];
  const value = cents / cfg.minorUnitsPerMajor;
  const decimals = cfg.minorUnitsPerMajor === 1 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cfg.code,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: "auto", // minus for negative only, no plus for positive
  }).format(value);
}

/**
 * Format for PDF/renderer - pure string concatenation, no Intl/toLocaleString.
 * Uses currency code (PHP, USD, etc.) to avoid font/encoding issues with symbols.
 * Returns "PHP 1,234.56" or "-PHP 500.00" - no ± signs.
 */
export function formatCentsPlain(cents: number, currency: CurrencyCode = "USD"): string {
  const cfg = CURRENCIES[currency];
  const value = cents / cfg.minorUnitsPerMajor;
  const decimals = cfg.minorUnitsPerMajor === 1 ? 0 : 2;
  const abs = Math.abs(value);
  const fixed = abs.toFixed(decimals);
  const [whole, frac] = fixed.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const numStr = frac !== undefined ? `${withCommas}.${frac}` : withCommas;
  const sign = value < 0 ? "-" : "";
  return sign + cfg.code + " " + numStr;
}

/**
 * Add two amounts in cents. Safe from floating-point errors.
 */
export function addCents(a: number, b: number): number {
  return a + b;
}

/**
 * Subtract b from a (in cents).
 */
export function subtractCents(a: number, b: number): number {
  return a - b;
}

/**
 * Calculate percentage of total (returns 0-100).
 */
export function percentOf(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 10000) / 100;
}

/**
 * Re-express an amount stored in one currency's minor units in another's.
 * Switching currency relabels the amount (no exchange rate): $10.55 → ¥11.
 */
export function rescaleMinor(amount: number, fromMinor: number, toMinor: number): number {
  if (fromMinor === toMinor) return amount;
  return Math.round((amount * toMinor) / fromMinor);
}

/**
 * Clean what a user typed into an amount field: digits and one decimal point only,
 * at most `decimals` decimal places. Commas, letters and minus signs are dropped.
 */
export function sanitizeAmountInput(raw: string, decimals: number): string {
  let out = "";
  let seenDot = false;
  let fraction = 0;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      if (seenDot) {
        if (fraction >= decimals) continue;
        fraction++;
      }
      out += ch;
    } else if (ch === "." && !seenDot) {
      seenDot = true;
      // Whole-unit currencies (JPY): ignore the fraction instead of merging digits.
      if (decimals > 0) out += ch;
    }
  }
  return out;
}

/**
 * Split a total into integer parts by percentages so the parts always add up exactly
 * (largest-remainder rounding). With percentages summing to 100 the parts sum to total.
 */
export function splitByPercentages(totalCents: number, percentages: number[]): number[] {
  const pctSum = percentages.reduce((s, p) => s + p, 0);
  const target = Math.round((totalCents * pctSum) / 100);
  const exact = percentages.map((p) => (totalCents * p) / 100);
  const parts = exact.map((x) => Math.floor(x + 1e-9));
  let leftover = target - parts.reduce((s, p) => s + p, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x + 1e-9) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; leftover > 0 && k < order.length; k++, leftover--) {
    parts[order[k].i] += 1;
  }
  return parts;
}
