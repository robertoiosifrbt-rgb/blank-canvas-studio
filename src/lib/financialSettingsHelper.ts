/**
 * ACHU-032 / ACHU-034 — Canonical Financial Settings Helpers
 * 
 * resolveTaxYearRange: dynamically compute tax year range based on mode.
 * getCanonicalSettings: retrieve the singleton settings record.
 * SETTINGS_KEY: the canonical settings key constant.
 */

import { ukTaxYear } from './ukDate';

export const SETTINGS_KEY = 'ACHU_MAIN_FINANCIAL_SETTINGS';

export type TaxYearRange = { start: string; end: string };

/**
 * Resolve tax year range based on stored settings and current London date.
 * - Automatic mode (or missing mode for legacy): derive dynamically from current date.
 * - Manual mode: use stored dates.
 */
export function resolveTaxYearRange(
  settings: { taxYearMode?: string; taxYearStart?: string; taxYearEnd?: string } | null | undefined,
  currentLondonDate: string,
): TaxYearRange {
  const mode = settings?.taxYearMode || 'Manual';

  if (mode === 'Automatic') {
    // Dynamic calculation — rolls over on 6 April automatically
    return ukTaxYear(currentLondonDate);
  }

  // Manual mode — use stored dates, fallback to dynamic if missing
  if (settings?.taxYearStart && settings?.taxYearEnd) {
    return { start: settings.taxYearStart, end: settings.taxYearEnd };
  }

  // Legacy records without dates — fall back to dynamic
  return ukTaxYear(currentLondonDate);
}
