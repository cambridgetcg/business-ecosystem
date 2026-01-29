/**
 * Banking Setup Domain
 *
 * Templates and utilities for configuring banking infrastructure
 * for different business models (SaaS, Trading, etc.)
 *
 * @module setup
 */

// SaaS Banking Setup
export {
  createSaaSBankingSetup,
  SAAS_BANKING_RECOMMENDATIONS,
} from './templates/saas-banking-setup.js';
export type {
  SaaSBankingSetup,
  ProcessorSetup,
  AccountSetup,
  FXProviderSetup,
  BankSelectionCriteria,
} from './templates/saas-banking-setup.js';

// Trading Banking Setup
export {
  createTradingBankingSetup,
  TRADING_BANKING_RECOMMENDATIONS,
} from './templates/trading-banking-setup.js';
export type {
  TradingBankingSetup,
  TradeBankSetup,
  FacilitySetup,
  TradingAccountSetup,
  TradingFXSetup,
  SupplierPaymentSetup,
} from './templates/trading-banking-setup.js';

// Consolidated View
export {
  createEmptyConsolidatedView,
  generateAlerts,
  calculateConcentrationRisk,
} from './templates/consolidated-view.js';
export type {
  ConsolidatedBankingView,
  BusinessUnitSummary,
  CurrencyPosition,
  BankPosition,
  FacilityByBank,
  ProcessorBalance,
  RelationshipsByTier,
  BankRelationshipSummary,
  ConsolidatedAlertType,
  ConsolidatedAlert,
} from './templates/consolidated-view.js';
