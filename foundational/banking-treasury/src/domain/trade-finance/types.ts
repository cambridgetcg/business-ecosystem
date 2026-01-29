/**
 * Trade Finance Types
 *
 * Types for trade finance instruments: Letters of Credit,
 * Documentary Collections, and Credit Facilities.
 *
 * @module trade-finance/types
 */

import type { Money } from '../../types/financial.js';

// =============================================================================
// TRADE TERMS
// =============================================================================

/**
 * Incoterms 2020 - International commercial terms.
 */
export type Incoterm =
  | 'EXW'    // Ex Works
  | 'FCA'    // Free Carrier
  | 'FAS'    // Free Alongside Ship
  | 'FOB'    // Free on Board
  | 'CFR'    // Cost and Freight
  | 'CIF'    // Cost, Insurance, Freight
  | 'CPT'    // Carriage Paid To
  | 'CIP'    // Carriage and Insurance Paid To
  | 'DAP'    // Delivered at Place
  | 'DPU'    // Delivered at Place Unloaded
  | 'DDP';   // Delivered Duty Paid

/**
 * Payment terms for trade transactions.
 */
export type TradePaymentTerms =
  | 'cash_in_advance'
  | 'letter_of_credit'
  | 'documentary_collection'
  | 'open_account'
  | 'consignment';

/**
 * Trade terms configuration.
 */
export interface TradeTerms {
  readonly incoterm: Incoterm;
  readonly paymentTerms: TradePaymentTerms;
  readonly paymentDays?: number | undefined;
  readonly earlyPaymentDiscount?: {
    readonly percentage: number;
    readonly withinDays: number;
  } | undefined;
}

// =============================================================================
// LETTER OF CREDIT TYPES
// =============================================================================

/**
 * Types of Letters of Credit.
 */
export type LCType =
  | 'irrevocable'
  | 'revocable'
  | 'confirmed'
  | 'unconfirmed'
  | 'standby'
  | 'transferable'
  | 'back_to_back';

/**
 * Letter of Credit status.
 */
export type LCStatus =
  | 'draft'
  | 'applied'
  | 'issued'
  | 'advised'
  | 'amended'
  | 'documents_presented'
  | 'documents_accepted'
  | 'paid'
  | 'expired'
  | 'cancelled';

/**
 * Document types required for LC presentation.
 */
export type LCDocumentType =
  | 'commercial_invoice'
  | 'bill_of_lading'
  | 'packing_list'
  | 'certificate_of_origin'
  | 'insurance_certificate'
  | 'inspection_certificate'
  | 'other';

/**
 * LC document requirement.
 */
export interface LCDocument {
  readonly type: LCDocumentType;
  readonly description: string;
  readonly copies: number;
  readonly originals: number;
}

/**
 * LC status change record.
 */
export interface LCStatusChange {
  readonly from: LCStatus;
  readonly to: LCStatus;
  readonly changedAt: Date;
  readonly changedBy: string;
  readonly notes?: string | undefined;
}

// =============================================================================
// CREDIT FACILITY TYPES
// =============================================================================

/**
 * Types of credit facilities.
 */
export type FacilityType =
  | 'revolving_credit'
  | 'term_loan'
  | 'inventory_financing'
  | 'receivables_financing'
  | 'import_financing'
  | 'export_financing'
  | 'overdraft'
  | 'guarantee';

/**
 * Credit facility status.
 */
export type FacilityStatus =
  | 'active'
  | 'fully_drawn'
  | 'expired'
  | 'defaulted'
  | 'cancelled';

/**
 * Interest rate configuration.
 */
export interface InterestRate {
  readonly type: 'fixed' | 'floating';
  readonly baseRate?: 'SOFR' | 'EURIBOR' | 'SONIA' | 'prime' | undefined;
  readonly spread: number;
  readonly floor?: number | undefined;
  readonly ceiling?: number | undefined;
}

/**
 * Covenant types on credit facilities.
 */
export type CovenantType = 'financial' | 'operational' | 'reporting';

/**
 * Covenant definition.
 */
export interface Covenant {
  readonly type: CovenantType;
  readonly name: string;
  readonly description: string;
  readonly metric?: string | undefined;
  readonly threshold?: number | undefined;
  readonly frequency: 'quarterly' | 'annually' | 'ongoing';
  readonly currentValue?: number | undefined;
  readonly inCompliance: boolean;
  readonly lastTestedAt?: Date | undefined;
}

/**
 * Collateral types.
 */
export type CollateralType =
  | 'inventory'
  | 'receivables'
  | 'equipment'
  | 'real_estate'
  | 'cash'
  | 'securities';

/**
 * Collateral information.
 */
export interface CollateralInfo {
  readonly type: CollateralType;
  readonly description: string;
  readonly value: Money;
  readonly valuationDate: Date;
}

// =============================================================================
// DOCUMENTARY COLLECTION TYPES
// =============================================================================

/**
 * Documentary collection types.
 */
export type DocumentaryCollectionType =
  | 'documents_against_payment'    // D/P
  | 'documents_against_acceptance'; // D/A

/**
 * Documentary collection status.
 */
export type DocumentaryCollectionStatus =
  | 'draft'
  | 'submitted'
  | 'in_transit'
  | 'presented'
  | 'accepted'
  | 'paid'
  | 'dishonored'
  | 'cancelled';
