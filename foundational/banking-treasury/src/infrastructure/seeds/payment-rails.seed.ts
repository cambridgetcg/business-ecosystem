/**
 * Payment Rails Seed Data
 *
 * Default payment rail configurations based on research.
 * @see docs/research/nuances/19_MULTI_RAIL_ORCHESTRATION.md
 */

import type { PaymentRail } from '../../domain/value-objects/payment-rail.js';

/**
 * Default payment rails for multi-rail orchestration.
 * These represent the most common payment networks with their
 * typical costs, speeds, and capabilities.
 */
export const defaultPaymentRails: Omit<PaymentRail, 'id'>[] = [
  // ==========================================================================
  // US DOMESTIC RAILS
  // ==========================================================================
  {
    type: 'ach',
    name: 'ACH Standard',
    provider: 'Federal Reserve / EPN',
    corridors: [
      {
        sourceCurrency: 'USD',
        destinationCurrency: 'USD',
        sourceCountries: ['US'],
        destinationCountries: ['US'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 0.25, currency: 'USD' },
      percentageFee: 0,
    },
    minSettlementMinutes: 1440, // 1 business day
    maxSettlementMinutes: 2880, // 2 business days
    availability: {
      is24x7: false,
      operatingDays: [1, 2, 3, 4, 5], // Mon-Fri
      timezone: 'America/New_York',
    },
    complianceRequirements: ['BSA', 'OFAC'],
    supportsRecall: true,
    supportsTracking: false,
    status: 'active',
  },
  {
    type: 'same_day_ach',
    name: 'Same Day ACH',
    provider: 'Federal Reserve / EPN',
    corridors: [
      {
        sourceCurrency: 'USD',
        destinationCurrency: 'USD',
        sourceCountries: ['US'],
        destinationCountries: ['US'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 1.0, currency: 'USD' },
      percentageFee: 0,
    },
    minSettlementMinutes: 60, // 1 hour
    maxSettlementMinutes: 480, // Same business day
    availability: {
      is24x7: false,
      operatingDays: [1, 2, 3, 4, 5],
      operatingHoursStart: '06:00',
      operatingHoursEnd: '16:45', // Last window at 16:45 ET
      timezone: 'America/New_York',
    },
    complianceRequirements: ['BSA', 'OFAC'],
    supportsRecall: true,
    supportsTracking: false,
    maxAmount: { amount: 1000000, currency: 'USD' },
    status: 'active',
  },
  {
    type: 'wire',
    name: 'Fedwire',
    provider: 'Federal Reserve',
    corridors: [
      {
        sourceCurrency: 'USD',
        destinationCurrency: 'USD',
        sourceCountries: ['US'],
        destinationCountries: ['US'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 25.0, currency: 'USD' },
      percentageFee: 0,
    },
    minSettlementMinutes: 0, // Near-instant
    maxSettlementMinutes: 60, // Within 1 hour
    availability: {
      is24x7: false,
      operatingDays: [1, 2, 3, 4, 5],
      operatingHoursStart: '09:00',
      operatingHoursEnd: '18:30',
      timezone: 'America/New_York',
    },
    complianceRequirements: ['BSA', 'OFAC'],
    supportsRecall: false, // Irrevocable
    supportsTracking: true,
    status: 'active',
  },
  {
    type: 'rtp',
    name: 'RTP (Real-Time Payments)',
    provider: 'The Clearing House',
    corridors: [
      {
        sourceCurrency: 'USD',
        destinationCurrency: 'USD',
        sourceCountries: ['US'],
        destinationCountries: ['US'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 0.5, currency: 'USD' },
      percentageFee: 0,
    },
    minSettlementMinutes: 0, // Instant
    maxSettlementMinutes: 1, // Seconds
    availability: {
      is24x7: true,
    },
    complianceRequirements: ['BSA', 'OFAC'],
    supportsRecall: false,
    supportsTracking: true,
    maxAmount: { amount: 1000000, currency: 'USD' },
    status: 'active',
  },
  {
    type: 'fednow',
    name: 'FedNow',
    provider: 'Federal Reserve',
    corridors: [
      {
        sourceCurrency: 'USD',
        destinationCurrency: 'USD',
        sourceCountries: ['US'],
        destinationCountries: ['US'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 0.045, currency: 'USD' },
      percentageFee: 0,
    },
    minSettlementMinutes: 0,
    maxSettlementMinutes: 1,
    availability: {
      is24x7: true,
    },
    complianceRequirements: ['BSA', 'OFAC'],
    supportsRecall: false,
    supportsTracking: true,
    maxAmount: { amount: 500000, currency: 'USD' },
    status: 'active',
  },

  // ==========================================================================
  // INTERNATIONAL RAILS
  // ==========================================================================
  {
    type: 'swift',
    name: 'SWIFT MT',
    provider: 'SWIFT',
    corridors: [
      {
        sourceCurrency: '*',
        destinationCurrency: '*',
        sourceCountries: ['*'],
        destinationCountries: ['*'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 35.0, currency: 'USD' },
      percentageFee: 0,
      fxSpread: 0.015, // 1.5% typical
    },
    minSettlementMinutes: 60,
    maxSettlementMinutes: 4320, // 3 days
    availability: {
      is24x7: false,
      operatingDays: [1, 2, 3, 4, 5],
      timezone: 'UTC',
    },
    complianceRequirements: ['BSA', 'OFAC', 'FATF'],
    supportsRecall: true,
    supportsTracking: false,
    status: 'active',
  },
  {
    type: 'swift_gpi',
    name: 'SWIFT gpi',
    provider: 'SWIFT',
    corridors: [
      {
        sourceCurrency: '*',
        destinationCurrency: '*',
        sourceCountries: ['*'],
        destinationCountries: ['*'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 40.0, currency: 'USD' },
      percentageFee: 0,
      fxSpread: 0.01, // 1% typical - better than standard SWIFT
    },
    minSettlementMinutes: 30,
    maxSettlementMinutes: 2880, // 2 days
    availability: {
      is24x7: false,
      operatingDays: [1, 2, 3, 4, 5],
      timezone: 'UTC',
    },
    complianceRequirements: ['BSA', 'OFAC', 'FATF'],
    supportsRecall: true,
    supportsTracking: true, // UETR tracking
    status: 'active',
  },

  // ==========================================================================
  // EUROPEAN RAILS
  // ==========================================================================
  {
    type: 'sepa',
    name: 'SEPA Credit Transfer',
    provider: 'EBA Clearing',
    corridors: [
      {
        sourceCurrency: 'EUR',
        destinationCurrency: 'EUR',
        sourceCountries: ['EU', 'EEA', 'GB', 'CH'],
        destinationCountries: ['EU', 'EEA', 'GB', 'CH'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 0.2, currency: 'EUR' },
      percentageFee: 0,
    },
    minSettlementMinutes: 60,
    maxSettlementMinutes: 1440, // 1 business day
    availability: {
      is24x7: false,
      operatingDays: [1, 2, 3, 4, 5],
      timezone: 'Europe/Brussels',
    },
    complianceRequirements: ['AMLD6', 'PSD2'],
    supportsRecall: true,
    supportsTracking: true,
    status: 'active',
  },
  {
    type: 'sepa_instant',
    name: 'SEPA Instant',
    provider: 'EBA Clearing',
    corridors: [
      {
        sourceCurrency: 'EUR',
        destinationCurrency: 'EUR',
        sourceCountries: ['EU', 'EEA'],
        destinationCountries: ['EU', 'EEA'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 0.2, currency: 'EUR' },
      percentageFee: 0,
    },
    minSettlementMinutes: 0,
    maxSettlementMinutes: 1, // 10 seconds target
    availability: {
      is24x7: true,
    },
    complianceRequirements: ['AMLD6', 'PSD2'],
    supportsRecall: true,
    supportsTracking: true,
    maxAmount: { amount: 100000, currency: 'EUR' },
    status: 'active',
  },

  // ==========================================================================
  // UK RAILS
  // ==========================================================================
  {
    type: 'chaps',
    name: 'CHAPS',
    provider: 'Bank of England',
    corridors: [
      {
        sourceCurrency: 'GBP',
        destinationCurrency: 'GBP',
        sourceCountries: ['GB'],
        destinationCountries: ['GB'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 25.0, currency: 'GBP' },
      percentageFee: 0,
    },
    minSettlementMinutes: 0,
    maxSettlementMinutes: 120, // 2 hours
    availability: {
      is24x7: false,
      operatingDays: [1, 2, 3, 4, 5],
      operatingHoursStart: '06:00',
      operatingHoursEnd: '18:00',
      timezone: 'Europe/London',
    },
    complianceRequirements: ['FCA', 'JMLSG'],
    supportsRecall: false,
    supportsTracking: true,
    status: 'active',
  },

  // ==========================================================================
  // STABLECOIN RAILS
  // ==========================================================================
  {
    type: 'stablecoin_usdc',
    name: 'USDC Transfer',
    provider: 'Circle',
    corridors: [
      {
        sourceCurrency: 'USD',
        destinationCurrency: 'USD',
        sourceCountries: ['*'],
        destinationCountries: ['*'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 1.0, currency: 'USD' },
      percentageFee: 0,
    },
    minSettlementMinutes: 1,
    maxSettlementMinutes: 15,
    availability: {
      is24x7: true,
    },
    complianceRequirements: ['BSA', 'OFAC', 'GENIUS_ACT'],
    supportsRecall: false, // Blockchain is irreversible
    supportsTracking: true, // On-chain tracking
    status: 'active',
  },
  {
    type: 'stablecoin_usdt',
    name: 'USDT Transfer',
    provider: 'Tether',
    corridors: [
      {
        sourceCurrency: 'USD',
        destinationCurrency: 'USD',
        sourceCountries: ['*'],
        destinationCountries: ['*'],
      },
    ],
    costStructure: {
      fixedFee: { amount: 1.0, currency: 'USD' },
      percentageFee: 0,
    },
    minSettlementMinutes: 1,
    maxSettlementMinutes: 15,
    availability: {
      is24x7: true,
    },
    complianceRequirements: ['BSA', 'OFAC'],
    supportsRecall: false,
    supportsTracking: true,
    status: 'active',
  },
];

/**
 * Get rails filtered by corridor.
 */
export function getRailsForCorridor(
  sourceCurrency: string,
  destCurrency: string,
  sourceCountry?: string,
  destCountry?: string
): Omit<PaymentRail, 'id'>[] {
  return defaultPaymentRails.filter((rail) =>
    rail.corridors.some((corridor) => {
      const currencyMatch =
        (corridor.sourceCurrency === sourceCurrency ||
          corridor.sourceCurrency === '*') &&
        (corridor.destinationCurrency === destCurrency ||
          corridor.destinationCurrency === '*');

      if (!currencyMatch) return false;

      if (sourceCountry) {
        const sourceMatch =
          corridor.sourceCountries.includes('*') ||
          corridor.sourceCountries.includes(sourceCountry);
        if (!sourceMatch) return false;
      }

      if (destCountry) {
        const destMatch =
          corridor.destinationCountries.includes('*') ||
          corridor.destinationCountries.includes(destCountry);
        if (!destMatch) return false;
      }

      return true;
    })
  );
}
