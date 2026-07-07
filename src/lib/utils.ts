import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param currency - Currency code: 'FCFA' (default), 'EUR', 'USD'
 * @param locale - Locale for formatting (default: 'fr-FR')
 */
export function formatCurrency(
  amount: number,
  currency: 'FCFA' | 'EUR' | 'USD' = 'FCFA',
  locale: string = 'fr-FR'
): string {
  if (currency === 'FCFA') {
    // FCFA n'admet aucune décimale : on plancher systématiquement.
    const safe = Math.floor(Number(amount) || 0);
    return `${safe.toLocaleString(locale)} FCFA`;
  }
  
  const currencyMap: Record<string, string> = {
    'EUR': 'EUR',
    'USD': 'USD',
  };
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyMap[currency],
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number as FCFA (shorthand)
 */
export function formatFCFA(amount: number): string {
  return formatCurrency(amount, 'FCFA');
}

/**
 * Safely extract an error message from an unknown error type.
 *
 * AUDIT FIX #43 / P2: this is now a thin re-export of the canonical
 * implementation in `lib/errors.ts`. Keeping the export here preserves
 * backward compatibility with the 3 files that import from `utils`,
 * while ensuring there is a SINGLE source of truth.
 */
export { getErrorMessage } from "./errors";
