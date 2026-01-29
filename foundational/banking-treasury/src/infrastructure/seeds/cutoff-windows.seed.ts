/**
 * Cutoff Windows Seed Data
 *
 * Default cutoff window configurations for major banks.
 * @see docs/research/nuances/10_PAYMENT_TIMING_CUTOFFS.md
 */

import type { CutoffWindow } from '../../domain/value-objects/cutoff-window.js';

/**
 * Cutoff window template (without IDs - to be assigned at persistence).
 * The bankId and railId are placeholders to be resolved at runtime.
 */
export interface CutoffWindowSeed {
  bankName: string; // To match against BankRelationship
  railType: string; // To match against PaymentRail type
  currency: string;
  cutoffTime: string;
  timezone: string;
  stpAdjustmentMinutes: number;
  activeDays: number[];
}

/**
 * J.P. Morgan cutoff windows.
 * Source: J.P. Morgan Access documentation
 */
export const jpMorganCutoffs: CutoffWindowSeed[] = [
  // USD Domestic
  {
    bankName: 'J.P. Morgan',
    railType: 'ach',
    currency: 'USD',
    cutoffTime: '17:00',
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    bankName: 'J.P. Morgan',
    railType: 'same_day_ach',
    currency: 'USD',
    cutoffTime: '14:15', // Second window
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 30,
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    bankName: 'J.P. Morgan',
    railType: 'wire',
    currency: 'USD',
    cutoffTime: '17:00',
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    bankName: 'J.P. Morgan',
    railType: 'rtp',
    currency: 'USD',
    cutoffTime: '23:59', // 24/7
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 0,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
  },
  // International
  {
    bankName: 'J.P. Morgan',
    railType: 'swift_gpi',
    currency: 'USD',
    cutoffTime: '15:00',
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    bankName: 'J.P. Morgan',
    railType: 'swift_gpi',
    currency: 'EUR',
    cutoffTime: '11:00',
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    bankName: 'J.P. Morgan',
    railType: 'swift_gpi',
    currency: 'GBP',
    cutoffTime: '12:00',
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
];

/**
 * Bank of America cutoff windows.
 */
export const boaCutoffs: CutoffWindowSeed[] = [
  {
    bankName: 'Bank of America',
    railType: 'ach',
    currency: 'USD',
    cutoffTime: '18:00',
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    bankName: 'Bank of America',
    railType: 'wire',
    currency: 'USD',
    cutoffTime: '17:30',
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    bankName: 'Bank of America',
    railType: 'swift_gpi',
    currency: 'USD',
    cutoffTime: '16:00',
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
];

/**
 * Citibank cutoff windows.
 */
export const citiCutoffs: CutoffWindowSeed[] = [
  {
    bankName: 'Citibank',
    railType: 'ach',
    currency: 'USD',
    cutoffTime: '20:00',
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    bankName: 'Citibank',
    railType: 'wire',
    currency: 'USD',
    cutoffTime: '17:00',
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    bankName: 'Citibank',
    railType: 'swift_gpi',
    currency: 'USD',
    cutoffTime: '14:30',
    timezone: 'America/New_York',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
];

/**
 * HSBC cutoff windows (UK focused).
 */
export const hsbcCutoffs: CutoffWindowSeed[] = [
  {
    bankName: 'HSBC',
    railType: 'chaps',
    currency: 'GBP',
    cutoffTime: '15:30',
    timezone: 'Europe/London',
    stpAdjustmentMinutes: 30,
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    bankName: 'HSBC',
    railType: 'sepa',
    currency: 'EUR',
    cutoffTime: '14:00',
    timezone: 'Europe/London',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    bankName: 'HSBC',
    railType: 'swift_gpi',
    currency: 'GBP',
    cutoffTime: '15:00',
    timezone: 'Europe/London',
    stpAdjustmentMinutes: 60,
    activeDays: [1, 2, 3, 4, 5],
  },
];

/**
 * All default cutoff windows.
 */
export const defaultCutoffWindows: CutoffWindowSeed[] = [
  ...jpMorganCutoffs,
  ...boaCutoffs,
  ...citiCutoffs,
  ...hsbcCutoffs,
];

/**
 * Get cutoff windows for a specific bank.
 */
export function getCutoffsForBank(bankName: string): CutoffWindowSeed[] {
  return defaultCutoffWindows.filter(
    (cutoff) => cutoff.bankName.toLowerCase() === bankName.toLowerCase()
  );
}

/**
 * Get cutoff windows for a specific rail type.
 */
export function getCutoffsForRail(railType: string): CutoffWindowSeed[] {
  return defaultCutoffWindows.filter(
    (cutoff) => cutoff.railType === railType
  );
}
