/**
 * Financial formatters for TradeWise.
 * Canonical Specification: frontend/SPECIFICATION.md §15
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const inrNumberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** Formats a numeric amount as Indian Rupees (₹) with en-IN digit grouping */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }

  return inrFormatter.format(amount);
}

/** Formats a number with Indian digit grouping without currency symbol */
export function formatIndianNumber(
  value: number | null | undefined,
  fractionDigits?: number
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  if (fractionDigits !== undefined) {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  }

  return inrNumberFormatter.format(value);
}

/** Formats a percentage with sign (+/-) and 2 decimal places */
export function formatPercentDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
