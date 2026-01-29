/**
 * Payment Rail Value Object
 *
 * Represents a payment network/rail with its capabilities, costs, and availability.
 * Core abstraction for multi-rail payment orchestration.
 *
 * @see docs/research/nuances/19_MULTI_RAIL_ORCHESTRATION.md
 */

import type { Money } from '../../types/financial.js';

/**
 * Supported payment rail types.
 * Each type has different cost, speed, and compliance characteristics.
 */
export type RailType =
  | 'swift'           // Traditional SWIFT MT messages
  | 'swift_gpi'       // SWIFT gpi with tracking
  | 'ach'             // ACH standard (1-2 day)
  | 'same_day_ach'    // Same-day ACH (3 windows)
  | 'rtp'             // RTP (The Clearing House) - instant
  | 'fednow'          // FedNow - instant
  | 'wire'            // Fedwire - same day, irrevocable
  | 'chaps'           // UK CHAPS - same day GBP
  | 'sepa'            // SEPA Credit Transfer
  | 'sepa_instant'    // SEPA Instant - 10 seconds
  | 'stablecoin_usdc' // USDC on-chain
  | 'stablecoin_usdt' // USDT on-chain
  | 'local';          // Local/regional rails (PIX, UPI, etc.)

/**
 * Payment corridor definition.
 * Defines the currency and geography pairs a rail supports.
 */
export interface Corridor {
  /** Source currency (ISO 4217) */
  sourceCurrency: string;
  /** Destination currency (ISO 4217), '*' for any */
  destinationCurrency: string;
  /** Source countries (ISO 3166-1 alpha-2), ['*'] for any */
  sourceCountries: string[];
  /** Destination countries (ISO 3166-1 alpha-2), ['*'] for any */
  destinationCountries: string[];
}

/**
 * Cost structure for a payment rail.
 * Supports fixed fees, percentage fees, and FX spreads.
 */
export interface CostStructure {
  /** Fixed fee per transaction */
  fixedFee: Money;
  /** Percentage fee (decimal, e.g., 0.01 = 1%) */
  percentageFee: number;
  /** FX spread if applicable (decimal) */
  fxSpread?: number;
  /** Minimum fee floor */
  minimumFee?: Money;
  /** Maximum fee cap */
  maximumFee?: Money;
}

/**
 * Availability schedule for a payment rail.
 * Defines when the rail is operational.
 */
export interface AvailabilitySchedule {
  /** True if rail operates 24/7/365 */
  is24x7: boolean;
  /** Operating days (0=Sunday, 6=Saturday), undefined if 24x7 */
  operatingDays?: number[];
  /** Operating hours start (HH:MM), undefined if 24x7 */
  operatingHoursStart?: string;
  /** Operating hours end (HH:MM), undefined if 24x7 */
  operatingHoursEnd?: string;
  /** IANA timezone for operating hours */
  timezone?: string;
}

/**
 * Payment Rail value object.
 * Immutable representation of a payment network's capabilities.
 */
export interface PaymentRail {
  /** Unique identifier */
  readonly id: string;
  /** Rail type category */
  readonly type: RailType;
  /** Human-readable name */
  readonly name: string;
  /** Provider/operator (e.g., 'Federal Reserve', 'SWIFT', 'Circle') */
  readonly provider?: string;
  /** Supported corridors */
  readonly corridors: Corridor[];
  /** Cost structure */
  readonly costStructure: CostStructure;
  /** Minimum settlement time in minutes */
  readonly minSettlementMinutes: number;
  /** Maximum settlement time in minutes */
  readonly maxSettlementMinutes: number;
  /** Operating schedule */
  readonly availability: AvailabilitySchedule;
  /** Required compliance checks (e.g., 'BSA', 'OFAC', 'FATF') */
  readonly complianceRequirements: string[];
  /** Whether payment can be recalled/reversed */
  readonly supportsRecall: boolean;
  /** Whether rail provides tracking (e.g., SWIFT gpi UETR) */
  readonly supportsTracking: boolean;
  /** Maximum transaction amount, if limited */
  readonly maxAmount?: Money;
  /** Current operational status */
  readonly status: 'active' | 'degraded' | 'disabled';
}

/**
 * Check if a rail supports a specific corridor.
 */
export function railSupportsCorridor(
  rail: PaymentRail,
  sourceCurrency: string,
  destCurrency: string,
  sourceCountry?: string,
  destCountry?: string
): boolean {
  return rail.corridors.some((corridor) => {
    const currencyMatch =
      (corridor.sourceCurrency === sourceCurrency || corridor.sourceCurrency === '*') &&
      (corridor.destinationCurrency === destCurrency || corridor.destinationCurrency === '*');

    if (!currencyMatch) return false;

    const sourceCountryMatch =
      !sourceCountry ||
      corridor.sourceCountries.includes('*') ||
      corridor.sourceCountries.includes(sourceCountry);

    const destCountryMatch =
      !destCountry ||
      corridor.destinationCountries.includes('*') ||
      corridor.destinationCountries.includes(destCountry);

    return sourceCountryMatch && destCountryMatch;
  });
}

/**
 * Calculate estimated cost for a payment on this rail.
 */
export function calculateRailCost(rail: PaymentRail, amount: Money): Money {
  const { costStructure } = rail;

  // Fixed fee + percentage
  let cost = costStructure.fixedFee.amount + amount.amount * costStructure.percentageFee;

  // Apply minimum if set
  if (costStructure.minimumFee && cost < costStructure.minimumFee.amount) {
    cost = costStructure.minimumFee.amount;
  }

  // Apply maximum if set
  if (costStructure.maximumFee && cost > costStructure.maximumFee.amount) {
    cost = costStructure.maximumFee.amount;
  }

  return {
    amount: cost,
    currency: costStructure.fixedFee.currency,
  };
}

/**
 * Check if a rail is currently available based on schedule.
 */
export function isRailAvailable(rail: PaymentRail, at: Date = new Date()): boolean {
  if (rail.status !== 'active') {
    return rail.status === 'degraded'; // Degraded is still usable
  }

  const { availability } = rail;

  if (availability.is24x7) {
    return true;
  }

  // Check operating day
  if (availability.operatingDays) {
    const dayOfWeek = at.getDay();
    if (!availability.operatingDays.includes(dayOfWeek)) {
      return false;
    }
  }

  // Check operating hours if specified
  if (availability.operatingHoursStart && availability.operatingHoursEnd && availability.timezone) {
    // Convert to rail's timezone and check hours
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: availability.timezone,
    });

    const timeInZone = formatter.format(at);
    const timeParts = timeInZone.split(':').map(Number);
    const hours = timeParts[0] ?? 0;
    const minutes = timeParts[1] ?? 0;
    const currentMinutes = hours * 60 + minutes;

    const startParts = availability.operatingHoursStart.split(':').map(Number);
    const endParts = availability.operatingHoursEnd.split(':').map(Number);
    const startH = startParts[0] ?? 0;
    const startM = startParts[1] ?? 0;
    const endH = endParts[0] ?? 0;
    const endM = endParts[1] ?? 0;
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return false;
    }
  }

  return true;
}
