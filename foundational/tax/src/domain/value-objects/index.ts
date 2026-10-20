/**
 * UK VAT value objects: the VAT schemes and the VAT rates the VAT calculator uses.
 *
 * Harvested from the January rescue branch (rescue/january-wip-2026-10-17 at fb40670,
 * foundational/tax/src/domain/value-objects/index.ts), VAT section only and unchanged. The rest
 * of that file (tax years, National Insurance, income tax, corporation tax, HMRC references,
 * student loans) is left for its own slice.
 */

import { z } from 'zod';

// =============================================================================
// VAT Schemes
// =============================================================================

export const VATSchemeSchema = z.enum([
  'standard',           // Standard VAT accounting
  'flat_rate',          // Flat Rate Scheme
  'cash_accounting',    // Cash Accounting Scheme
  'annual_accounting',  // Annual Accounting Scheme
]);
export type VATScheme = z.infer<typeof VATSchemeSchema>;

/**
 * UK VAT rates
 */
export const VATRates = {
  STANDARD: 0.20,       // 20%
  REDUCED: 0.05,        // 5%
  ZERO: 0.00,           // 0%
} as const;
