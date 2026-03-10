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
