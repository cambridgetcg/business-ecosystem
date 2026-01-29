/**
 * Value Objects for Entity Governance Domain
 *
 * Immutable objects that represent domain concepts without identity.
 */

import { z } from 'zod';

// =============================================================================
// Jurisdiction
// =============================================================================

export const JurisdictionSchema = z.object({
  country: z.string().length(2), // ISO 3166-1 alpha-2
  state: z.string().max(100).optional(),
});

export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

export function createJurisdiction(country: string, state?: string): Jurisdiction {
  return JurisdictionSchema.parse({ country: country.toUpperCase(), state });
}

export function formatJurisdiction(jurisdiction: Jurisdiction): string {
  return jurisdiction.state
    ? jurisdiction.state + ', ' + jurisdiction.country
    : jurisdiction.country;
}

// =============================================================================
// Address
// =============================================================================

export const AddressSchema = z.object({
  line1: z.string().max(255),
  line2: z.string().max(255).optional(),
  city: z.string().max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20),
  country: z.string().length(2),
});

export type Address = z.infer<typeof AddressSchema>;

// =============================================================================
// Money (stored as cents/minor units)
// =============================================================================

export const MoneySchema = z.object({
  amount: z.number().int(), // cents
  currency: z.string().length(3), // ISO 4217
});

export type Money = z.infer<typeof MoneySchema>;

export function createMoney(amount: number, currency: string = 'USD'): Money {
  return { amount: Math.round(amount * 100), currency: currency.toUpperCase() };
}

export function formatMoney(money: Money): string {
  const dollars = money.amount / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency,
  }).format(dollars);
}

// =============================================================================
// Percentage (stored as basis points: 10000 = 100%)
// =============================================================================

export const PercentageSchema = z.number().int().min(0).max(10000);

export type Percentage = z.infer<typeof PercentageSchema>;

export function createPercentage(percent: number): Percentage {
  return Math.round(percent * 100);
}

export function formatPercentage(basisPoints: Percentage): string {
  return (basisPoints / 100).toFixed(2) + '%';
}

// =============================================================================
// Entity Types
// =============================================================================

export const EntityTypeSchema = z.enum([
  'corporation',
  'llc',
  'lp',
  'llp',
  'partnership',
  'sole_proprietorship',
  'nonprofit',
  'trust',
  'other',
]);

export type EntityType = z.infer<typeof EntityTypeSchema>;

// =============================================================================
// Entity Status
// =============================================================================

export const EntityStatusSchema = z.enum([
  'active',
  'inactive',
  'dissolved',
  'merged',
  'converted',
  'suspended',
]);

export type EntityStatus = z.infer<typeof EntityStatusSchema>;

// =============================================================================
// Share Class Type
// =============================================================================

export const ShareClassTypeSchema = z.enum([
  'common',
  'preferred',
  'series_a',
  'series_b',
  'series_c',
  'convertible',
  'other',
]);

export type ShareClassType = z.infer<typeof ShareClassTypeSchema>;

// =============================================================================
// Officer Title
// =============================================================================

export const OfficerTitleSchema = z.enum([
  'ceo',
  'cfo',
  'coo',
  'cto',
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'general_counsel',
  'other',
]);

export type OfficerTitle = z.infer<typeof OfficerTitleSchema>;

// =============================================================================
// Filing Status
// =============================================================================

export const FilingStatusSchema = z.enum([
  'pending',
  'submitted',
  'accepted',
  'rejected',
  'overdue',
]);

export type FilingStatus = z.infer<typeof FilingStatusSchema>;
