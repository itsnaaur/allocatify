/**
 * Supported currencies. Amounts are stored in minor units (e.g. cents for USD).
 * minorUnitsPerMajor: 100 for currencies with decimals, 1 for JPY etc.
 */

export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD" | "INR" | "CHF" | "PHP";

export const CURRENCIES: Record<
  CurrencyCode,
  { code: CurrencyCode; symbol: string; name: string; minorUnitsPerMajor: number }
> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", minorUnitsPerMajor: 100 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", minorUnitsPerMajor: 100 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", minorUnitsPerMajor: 100 },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", minorUnitsPerMajor: 1 },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", minorUnitsPerMajor: 100 },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", minorUnitsPerMajor: 100 },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", minorUnitsPerMajor: 100 },
  CHF: { code: "CHF", symbol: "CHF", name: "Swiss Franc", minorUnitsPerMajor: 100 },
  PHP: { code: "PHP", symbol: "₱", name: "Philippine Peso", minorUnitsPerMajor: 100 },
};

export const DEFAULT_CURRENCY: CurrencyCode = "USD";
