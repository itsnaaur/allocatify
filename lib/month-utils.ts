/**
 * Utilities for month-based allocation labels.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Format "YYYY-MM" to "Month YYYY" (e.g., "2025-03" -> "March 2025").
 */
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (isNaN(year) || isNaN(month)) return monthKey;
  const name = MONTH_NAMES[month - 1];
  return name ? `${name} ${year}` : monthKey;
}

/**
 * Get monthKey for a given Date (e.g., "2025-03").
 */
export function getMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Get next month's monthKey from a given monthKey.
 */
export function getNextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (month === 12) return `${year + 1}-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Get monthKeys for the next N months from a start monthKey.
 */
export function getUpcomingMonthKeys(fromMonthKey: string, count: number): string[] {
  const result: string[] = [];
  let current = fromMonthKey;
  for (let i = 0; i < count; i++) {
    result.push(current);
    current = getNextMonthKey(current);
  }
  return result;
}

/**
 * Shift a monthKey by n months (n may be negative).
 */
export function addMonths(monthKey: string, n: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const index = year * 12 + (month - 1) + n;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Number of months from a to b (b - a). Same month = 0.
 */
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return by * 12 + bm - (ay * 12 + am);
}

/**
 * Number of days in the month of a monthKey.
 */
export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}
