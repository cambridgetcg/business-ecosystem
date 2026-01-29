/**
 * Account Purpose Value Object
 *
 * Classifies bank accounts by their business function.
 * Enables routing, reporting, and compliance by purpose.
 *
 * @module business/value-objects
 */

import type { Money } from '../../../types/financial.js';

/**
 * Classification of account purpose within the treasury structure.
 */
export type AccountPurposeType =
  | 'operating'           // Day-to-day operations
  | 'revenue'             // Inbound customer payments
  | 'payables'            // Outbound vendor payments
  | 'payroll'             // Employee compensation
  | 'tax_reserve'         // Tax obligations set aside
  | 'working_capital'     // Trade finance working capital
  | 'fx_settlement'       // FX conversion settlements
  | 'escrow'              // Third-party escrow
  | 'investment'          // Short-term investments
  | 'intercompany';       // Intercompany settlements

/**
 * Audit level requirements for account operations.
 */
export type AuditLevel = 'standard' | 'enhanced' | 'regulatory';

/**
 * Account Purpose value object.
 *
 * Defines the business function of an account, including
 * balance targets, segregation requirements, and audit levels.
 */
export interface AccountPurpose {
  readonly type: AccountPurposeType;
  readonly description: string;

  /** Minimum balance to maintain for this purpose */
  readonly targetMinimumBalance?: Money | undefined;

  /** Maximum balance before sweeping elsewhere */
  readonly targetMaximumBalance?: Money | undefined;

  /** Whether this purpose requires segregated accounting */
  readonly requiresSegregation: boolean;

  /** Audit trail requirements */
  readonly auditLevel: AuditLevel;
}

/**
 * Default account purposes with standard configurations.
 */
export const DEFAULT_ACCOUNT_PURPOSES: Record<AccountPurposeType, Omit<AccountPurpose, 'targetMinimumBalance' | 'targetMaximumBalance'>> = {
  operating: {
    type: 'operating',
    description: 'Primary operating account for day-to-day business transactions',
    requiresSegregation: false,
    auditLevel: 'standard',
  },
  revenue: {
    type: 'revenue',
    description: 'Collection account for customer payments and receivables',
    requiresSegregation: false,
    auditLevel: 'standard',
  },
  payables: {
    type: 'payables',
    description: 'Disbursement account for vendor and supplier payments',
    requiresSegregation: false,
    auditLevel: 'standard',
  },
  payroll: {
    type: 'payroll',
    description: 'Dedicated account for employee compensation',
    requiresSegregation: true,
    auditLevel: 'enhanced',
  },
  tax_reserve: {
    type: 'tax_reserve',
    description: 'Reserved funds for tax obligations',
    requiresSegregation: true,
    auditLevel: 'regulatory',
  },
  working_capital: {
    type: 'working_capital',
    description: 'Trade finance and working capital facility draws',
    requiresSegregation: false,
    auditLevel: 'enhanced',
  },
  fx_settlement: {
    type: 'fx_settlement',
    description: 'Foreign exchange conversion and settlement',
    requiresSegregation: false,
    auditLevel: 'standard',
  },
  escrow: {
    type: 'escrow',
    description: 'Third-party escrow holding account',
    requiresSegregation: true,
    auditLevel: 'regulatory',
  },
  investment: {
    type: 'investment',
    description: 'Short-term investment and money market holdings',
    requiresSegregation: false,
    auditLevel: 'standard',
  },
  intercompany: {
    type: 'intercompany',
    description: 'Intercompany settlement and netting account',
    requiresSegregation: true,
    auditLevel: 'enhanced',
  },
};

/**
 * Create an AccountPurpose with balance targets.
 */
export function createAccountPurpose(
  type: AccountPurposeType,
  options?: {
    targetMinimumBalance?: Money;
    targetMaximumBalance?: Money;
    overrideDescription?: string;
    overrideAuditLevel?: AuditLevel;
  }
): AccountPurpose {
  const defaults = DEFAULT_ACCOUNT_PURPOSES[type];

  return {
    ...defaults,
    description: options?.overrideDescription ?? defaults.description,
    auditLevel: options?.overrideAuditLevel ?? defaults.auditLevel,
    targetMinimumBalance: options?.targetMinimumBalance,
    targetMaximumBalance: options?.targetMaximumBalance,
  };
}
