/**
 * SaaS Banking Setup Template
 *
 * Defines the recommended banking structure for a SaaS business unit.
 * Optimized for recurring billing, global customer base, and predictable cash flows.
 *
 * @module setup/templates
 */

import type { Money, PaymentMethod } from '../../../types/financial.js';
import type { PaymentProcessorType } from '../../processors/types.js';
import type { AccountPurposeType } from '../../business/value-objects/account-purpose.js';
import type { RelationshipTier } from '../../relationships/types.js';
import type { BankAccountType } from '../../../types/financial.js';

/**
 * Processor setup configuration.
 */
export interface ProcessorSetup {
  readonly processorType: PaymentProcessorType;
  readonly purpose: 'subscription_billing' | 'one_time_payments' | 'marketplace';
  readonly settlementFrequency: 'daily' | 'weekly';
  readonly settlementAccountPurpose: AccountPurposeType;
  readonly priority: 'primary' | 'secondary';
}

/**
 * Account setup configuration.
 */
export interface AccountSetup {
  readonly purpose: AccountPurposeType;
  readonly recommendedType: BankAccountType;
  readonly minimumOpeningBalance?: Money;
  readonly features: string[];
  readonly isPrimary: boolean;
}

/**
 * FX provider configuration.
 */
export interface FXProviderSetup {
  readonly type: 'bank_integrated' | 'specialist';
  readonly preferredProviders: string[];
  readonly hedgingStrategy: 'none' | 'natural' | 'forward' | 'option';
  readonly autoConvert: boolean;
}

/**
 * Bank selection criteria.
 */
export interface BankSelectionCriteria {
  readonly requiredCapabilities: string[];
  readonly preferredTier: RelationshipTier;
  readonly minimumCreditRating?: string;
  readonly preferredBanks: string[];
  readonly avoidBanks?: string[];
}

/**
 * SaaS Banking Setup Template
 */
export interface SaaSBankingSetup {
  readonly businessUnitId: string;
  readonly setupType: 'saas';

  /** Payment processor configuration */
  readonly processors: ProcessorSetup[];

  /** Bank account structure */
  readonly accounts: AccountSetup[];

  /** FX configuration */
  readonly fxProvider: FXProviderSetup;

  /** Recommended bank relationship */
  readonly bankCriteria: BankSelectionCriteria;

  /** Permitted payment rails */
  readonly permittedRails: PaymentMethod[];

  /** Compliance requirements */
  readonly complianceRequirements: string[];
}

/**
 * Create a SaaS banking setup template.
 *
 * @param businessUnitId - Business unit identifier
 * @param functionalCurrency - Primary currency
 * @param isGlobal - Whether business serves global customers
 */
export function createSaaSBankingSetup(
  businessUnitId: string,
  functionalCurrency: string,
  isGlobal: boolean = true
): SaaSBankingSetup {
  return {
    businessUnitId,
    setupType: 'saas',

    processors: [
      {
        processorType: 'stripe',
        purpose: 'subscription_billing',
        settlementFrequency: 'daily',
        settlementAccountPurpose: 'revenue',
        priority: 'primary',
      },
      ...(isGlobal ? [{
        processorType: 'adyen' as PaymentProcessorType,
        purpose: 'subscription_billing' as const,
        settlementFrequency: 'daily' as const,
        settlementAccountPurpose: 'revenue' as AccountPurposeType,
        priority: 'secondary' as const,
      }] : []),
    ],

    accounts: [
      {
        purpose: 'operating',
        recommendedType: 'checking',
        minimumOpeningBalance: { amount: 50000, currency: functionalCurrency },
        features: ['online_banking', 'ach_origination', 'wire_transfer', 'positive_pay'],
        isPrimary: true,
      },
      {
        purpose: 'revenue',
        recommendedType: 'checking',
        minimumOpeningBalance: { amount: 10000, currency: functionalCurrency },
        features: ['online_banking', 'sweep_to_operating'],
        isPrimary: true,
      },
      {
        purpose: 'payroll',
        recommendedType: 'checking',
        minimumOpeningBalance: { amount: 0, currency: functionalCurrency },
        features: ['ach_origination', 'payroll_integration'],
        isPrimary: true,
      },
      {
        purpose: 'tax_reserve',
        recommendedType: 'savings',
        minimumOpeningBalance: { amount: 0, currency: functionalCurrency },
        features: ['interest_bearing'],
        isPrimary: true,
      },
    ],

    fxProvider: {
      type: isGlobal ? 'specialist' : 'bank_integrated',
      preferredProviders: isGlobal
        ? ['wise', 'ofx', 'western_union_business']
        : [],
      hedgingStrategy: 'natural', // Natural hedge from global revenue
      autoConvert: true,
    },

    bankCriteria: {
      requiredCapabilities: [
        'online_banking',
        'ach_origination',
        'wire_transfer',
        'api_access',
      ],
      preferredTier: 'primary',
      minimumCreditRating: 'A-',
      preferredBanks: [
        'mercury',         // SaaS-friendly, excellent API
        'brex',            // SaaS/startup focused
        'chase',           // Traditional with good APIs
        'silicon_valley_bank', // Tech-focused (if available)
        'first_republic',  // High-touch service
      ],
    },

    permittedRails: [
      'ach',
      'same_day_ach',
      'wire',
      'rtp',
      'sepa',
      'sepa_instant',
    ],

    complianceRequirements: [
      'pci_dss',          // For card data
      'soc2_type2',       // Customer trust
      'gdpr',             // If EU customers
    ],
  };
}

/**
 * SaaS Banking Setup Recommendations
 */
export const SAAS_BANKING_RECOMMENDATIONS = {
  processorSelection: {
    stripe: {
      bestFor: ['subscription_billing', 'global_payments', 'developer_experience'],
      considerations: ['2.9% + 30c pricing', 'Excellent for recurring', 'Strong APIs'],
    },
    adyen: {
      bestFor: ['enterprise_saas', 'high_volume', 'unified_commerce'],
      considerations: ['Volume-based pricing', 'Better for enterprise', 'Strong in EU'],
    },
    checkout_com: {
      bestFor: ['eu_focused', 'alternative_payment_methods'],
      considerations: ['Strong in EU/UK', 'Good for local methods'],
    },
  },

  bankSelection: {
    mercury: {
      bestFor: ['saas_startups', 'api_first', 'treasury_automation'],
      considerations: ['No minimums', 'Excellent API', 'Integrates with Stripe'],
    },
    brex: {
      bestFor: ['funded_startups', 'expense_management', 'corporate_cards'],
      considerations: ['Venture-backed required', 'Good card program', 'Modern experience'],
    },
    chase: {
      bestFor: ['established_saas', 'credit_relationship', 'full_service'],
      considerations: ['Traditional bank', 'Credit facilities available', 'Branch network'],
    },
  },

  accountStructure: {
    minimum: ['operating', 'revenue', 'payroll'],
    recommended: ['operating', 'revenue', 'payroll', 'tax_reserve'],
    enterprise: ['operating', 'revenue', 'payroll', 'tax_reserve', 'investment'],
  },

  fxStrategy: {
    under1m_arr: 'bank_integrated', // Use bank FX, volume too low for specialists
    under10m_arr: 'specialist',     // Use Wise/OFX for better rates
    over10m_arr: 'hybrid',          // Negotiate bank rates, use specialists for spot
  },
} as const;
