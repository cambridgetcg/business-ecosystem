/**
 * Business Structure Domain
 *
 * Models organizational structure for banking context.
 * BusinessUnit is the primary aggregate linking accounts, processors,
 * and bank relationships to specific business functions.
 *
 * @module business
 */

// Entities
export { BusinessUnit } from './entities/business-unit.js';
export type {
  BusinessUnitType,
  BusinessUnitStatus,
  BusinessUnitProps,
  AccountAssignment,
} from './entities/business-unit.js';

// Value Objects
export {
  DEFAULT_ACCOUNT_PURPOSES,
  createAccountPurpose,
} from './value-objects/account-purpose.js';
export type {
  AccountPurposeType,
  AccountPurpose,
  AuditLevel,
} from './value-objects/account-purpose.js';

export {
  createDefaultBankingPolicy,
  createSaaSBankingPolicy,
  createTradingBankingPolicy,
} from './value-objects/banking-policy.js';
export type {
  BankingPolicy,
  ApprovalThreshold,
  DualControlOperation,
  DualControlRule,
  ComplianceCheckType,
  CounterpartyRule,
  FXPolicy,
} from './value-objects/banking-policy.js';
