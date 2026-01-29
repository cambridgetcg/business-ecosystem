/**
 * Trading Banking Setup Template
 *
 * Defines the recommended banking structure for a physical goods trading business.
 * Optimized for trade finance, working capital, FX management, and supplier payments.
 *
 * @module setup/templates
 */

import type { Money, PaymentMethod } from '../../../types/financial.js';
import type { FacilityType } from '../../trade-finance/types.js';
import type { AccountPurposeType } from '../../business/value-objects/account-purpose.js';
import type { RelationshipTier } from '../../relationships/types.js';
import type { BankAccountType } from '../../../types/financial.js';

/**
 * Trade bank setup configuration.
 */
export interface TradeBankSetup {
  readonly requiredProducts: ('letter_of_credit' | 'documentary_collection' | 'bank_guarantee')[];
  readonly lcCapacity: Money;
  readonly preferredBanks: string[];
  readonly geographicCoverage: string[];
  readonly priority: 'primary' | 'secondary';
}

/**
 * Working capital facility setup.
 */
export interface FacilitySetup {
  readonly facilityType: FacilityType;
  readonly targetCommitment: Money;
  readonly purpose: string;
  readonly collateralType?: string;
  readonly expectedUtilization: number; // Percentage
}

/**
 * Account setup for trading.
 */
export interface TradingAccountSetup {
  readonly purpose: AccountPurposeType;
  readonly recommendedType: BankAccountType;
  readonly minimumOpeningBalance?: Money;
  readonly features: string[];
  readonly isPrimary: boolean;
  readonly currency: string;
}

/**
 * FX configuration for trading.
 */
export interface TradingFXSetup {
  readonly type: 'bank_integrated' | 'specialist' | 'hybrid';
  readonly preferredProviders: string[];
  readonly hedgingStrategy: 'none' | 'forward' | 'option' | 'ndf';
  readonly exposureCurrencies: string[];
  readonly hedgeRatio: number; // Percentage of exposure to hedge
}

/**
 * Supplier payment configuration.
 */
export interface SupplierPaymentSetup {
  readonly preferredRails: PaymentMethod[];
  readonly paymentTerms: string[];
  readonly earlyPaymentDiscount: boolean;
}

/**
 * Trading Banking Setup Template
 */
export interface TradingBankingSetup {
  readonly businessUnitId: string;
  readonly setupType: 'trading';

  /** Trade finance bank configuration */
  readonly tradeBanks: TradeBankSetup[];

  /** Working capital facility */
  readonly facilities: FacilitySetup[];

  /** Bank account structure */
  readonly accounts: TradingAccountSetup[];

  /** FX configuration */
  readonly fxSetup: TradingFXSetup;

  /** Supplier payment configuration */
  readonly supplierPayments: SupplierPaymentSetup;

  /** Bank selection criteria */
  readonly bankCriteria: {
    readonly tradeFinanceBank: {
      readonly requiredCapabilities: string[];
      readonly preferredTier: RelationshipTier;
      readonly preferredBanks: string[];
    };
    readonly operatingBank: {
      readonly requiredCapabilities: string[];
      readonly preferredTier: RelationshipTier;
      readonly preferredBanks: string[];
    };
  };

  /** Compliance requirements */
  readonly complianceRequirements: string[];
}

/**
 * Create a Trading banking setup template.
 *
 * @param businessUnitId - Business unit identifier
 * @param functionalCurrency - Primary currency
 * @param tradingRegions - Regions where suppliers/customers are located
 * @param annualTradeVolume - Expected annual trade volume for facility sizing
 */
export function createTradingBankingSetup(
  businessUnitId: string,
  functionalCurrency: string,
  tradingRegions: string[],
  annualTradeVolume: Money
): TradingBankingSetup {
  // Calculate facility sizes based on trade volume
  const wcLineSize = annualTradeVolume.amount * 0.2; // 20% of annual volume
  const lcCapacity = annualTradeVolume.amount * 0.15; // 15% of annual volume

  return {
    businessUnitId,
    setupType: 'trading',

    tradeBanks: [
      {
        requiredProducts: ['letter_of_credit', 'documentary_collection', 'bank_guarantee'],
        lcCapacity: { amount: lcCapacity, currency: functionalCurrency },
        preferredBanks: [
          'hsbc',            // Global trade finance leader
          'standard_chartered', // Strong in Asia
          'citi',            // Global coverage
          'deutsche_bank',   // Strong in Europe
          'bnp_paribas',     // Strong in Europe/Africa
        ],
        geographicCoverage: tradingRegions,
        priority: 'primary',
      },
    ],

    facilities: [
      {
        facilityType: 'revolving_credit',
        targetCommitment: { amount: wcLineSize, currency: functionalCurrency },
        purpose: 'General working capital for trade finance',
        expectedUtilization: 50,
      },
      {
        facilityType: 'import_financing',
        targetCommitment: { amount: wcLineSize * 0.5, currency: functionalCurrency },
        purpose: 'Import financing against LC/collection documents',
        collateralType: 'inventory',
        expectedUtilization: 70,
      },
    ],

    accounts: [
      {
        purpose: 'operating',
        recommendedType: 'checking',
        minimumOpeningBalance: { amount: 100000, currency: functionalCurrency },
        features: ['online_banking', 'wire_transfer', 'positive_pay', 'dual_authorization'],
        isPrimary: true,
        currency: functionalCurrency,
      },
      {
        purpose: 'payables',
        recommendedType: 'checking',
        minimumOpeningBalance: { amount: 50000, currency: functionalCurrency },
        features: ['wire_transfer', 'international_payments', 'batch_payments'],
        isPrimary: true,
        currency: functionalCurrency,
      },
      {
        purpose: 'working_capital',
        recommendedType: 'checking',
        minimumOpeningBalance: { amount: 0, currency: functionalCurrency },
        features: ['facility_draw', 'facility_repay'],
        isPrimary: true,
        currency: functionalCurrency,
      },
      // Multi-currency accounts for major trading currencies
      ...tradingRegions.includes('EU') ? [{
        purpose: 'fx_settlement' as AccountPurposeType,
        recommendedType: 'checking' as BankAccountType,
        features: ['fx_settlement', 'euro_payments'],
        isPrimary: false,
        currency: 'EUR',
      }] : [],
      ...tradingRegions.includes('CN') ? [{
        purpose: 'fx_settlement' as AccountPurposeType,
        recommendedType: 'checking' as BankAccountType,
        features: ['fx_settlement', 'rmb_payments'],
        isPrimary: false,
        currency: 'CNY',
      }] : [],
    ],

    fxSetup: {
      type: 'hybrid',
      preferredProviders: [
        'trading_bank',    // Use trade bank for large transactions
        'cambridge_fx',    // Specialist for mid-market
        'western_union_business', // Emerging markets
      ],
      hedgingStrategy: 'forward',
      exposureCurrencies: ['EUR', 'GBP', 'CNY', 'JPY'].filter(c =>
        tradingRegions.some(r => getCurrencyForRegion(r) === c)
      ),
      hedgeRatio: 70, // Hedge 70% of exposure
    },

    supplierPayments: {
      preferredRails: ['swift_gpi', 'swift', 'wire', 'sepa'],
      paymentTerms: ['net_30', 'net_60', 'letter_of_credit'],
      earlyPaymentDiscount: true,
    },

    bankCriteria: {
      tradeFinanceBank: {
        requiredCapabilities: [
          'letter_of_credit_issuance',
          'documentary_collections',
          'bank_guarantees',
          'trade_finance_portal',
          'swift_connectivity',
        ],
        preferredTier: 'primary',
        preferredBanks: ['hsbc', 'standard_chartered', 'citi', 'deutsche_bank'],
      },
      operatingBank: {
        requiredCapabilities: [
          'international_wire',
          'multi_currency_accounts',
          'fx_spot',
          'fx_forward',
          'online_banking',
        ],
        preferredTier: 'primary',
        preferredBanks: ['jpmorgan', 'citi', 'hsbc', 'wells_fargo'],
      },
    },

    complianceRequirements: [
      'kyc_enhanced',     // Enhanced KYC for trade
      'aml_trade',        // Trade-based money laundering checks
      'sanctions',        // OFAC/EU sanctions
      'dual_use',         // Dual-use goods checks if applicable
      'country_risk',     // Country risk assessment
    ],
  };
}

/**
 * Helper to map regions to currencies.
 */
function getCurrencyForRegion(region: string): string {
  const regionCurrencies: Record<string, string> = {
    'EU': 'EUR',
    'UK': 'GBP',
    'CN': 'CNY',
    'JP': 'JPY',
    'US': 'USD',
    'IN': 'INR',
    'BR': 'BRL',
    'MX': 'MXN',
  };
  return regionCurrencies[region] ?? 'USD';
}

/**
 * Trading Banking Setup Recommendations
 */
export const TRADING_BANKING_RECOMMENDATIONS = {
  bankSelection: {
    hsbc: {
      bestFor: ['asia_trade', 'global_trade_finance', 'documentary_credits'],
      considerations: ['Strong trade finance', 'Global network', 'Trade portal'],
      lcCapacity: 'High',
    },
    standard_chartered: {
      bestFor: ['asia_africa_trade', 'emerging_markets', 'commodity_finance'],
      considerations: ['Strong in EM', 'Commodity expertise', 'Good network'],
      lcCapacity: 'High',
    },
    citi: {
      bestFor: ['americas_trade', 'treasury_management', 'multi_bank'],
      considerations: ['Global treasury', 'Good technology', 'Multi-bank'],
      lcCapacity: 'High',
    },
    deutsche_bank: {
      bestFor: ['europe_trade', 'german_suppliers', 'fx_hedging'],
      considerations: ['Strong in Europe', 'Good FX', 'Trade expertise'],
      lcCapacity: 'Medium-High',
    },
  },

  facilityStructure: {
    startup: {
      wcLine: '10-20% of annual trade volume',
      lcFacility: 'Combined with WC line',
      collateral: 'Personal guarantee + inventory',
    },
    growing: {
      wcLine: '15-25% of annual trade volume',
      lcFacility: 'Separate LC sublimit',
      collateral: 'Inventory + receivables',
    },
    established: {
      wcLine: '20-30% of annual trade volume',
      lcFacility: 'Separate committed facility',
      collateral: 'Asset-based or unsecured',
    },
  },

  fxStrategy: {
    under5m_trade: {
      approach: 'Spot with bank',
      hedging: 'Natural hedge only',
      providers: ['operating_bank'],
    },
    under25m_trade: {
      approach: 'Spot + limited forwards',
      hedging: '50% of 90-day exposure',
      providers: ['operating_bank', 'fx_specialist'],
    },
    over25m_trade: {
      approach: 'Full hedging program',
      hedging: '70% of exposure with forwards',
      providers: ['trade_bank', 'fx_specialist', 'trading_platform'],
    },
  },

  paymentOptimization: {
    high_value_single: ['swift_gpi'], // Track and trace
    regular_supplier: ['wire', 'swift'], // Standard wire
    eu_supplier: ['sepa'], // Free SEPA
    recurring_supplier: ['ach', 'sepa_dd'], // Direct debit if possible
  },
} as const;
