/**
 * Dependency Injection Tokens
 *
 * Defines all injectable dependencies in the system.
 * Using symbol tokens for container registration.
 *
 * @module core/di/tokens
 */

/**
 * Infrastructure tokens - external dependencies
 */
export const TOKENS = {
  // Database
  DatabasePool: Symbol.for('DatabasePool'),
  DatabaseConnection: Symbol.for('DatabaseConnection'),

  // Cache
  CacheService: Symbol.for('CacheService'),
  RedisClient: Symbol.for('RedisClient'),

  // Event Publishing
  EventPublisher: Symbol.for('EventPublisher'),
  EventBus: Symbol.for('EventBus'),

  // Configuration
  Config: Symbol.for('Config'),
  Logger: Symbol.for('Logger'),

  // Repositories (Domain Interfaces)
  BankAccountRepository: Symbol.for('BankAccountRepository'),
  PaymentRepository: Symbol.for('PaymentRepository'),
  PaymentRailRepository: Symbol.for('PaymentRailRepository'),
  CutoffWindowRepository: Symbol.for('CutoffWindowRepository'),
  HolidayCalendarRepository: Symbol.for('HolidayCalendarRepository'),
  RoutingDecisionRepository: Symbol.for('RoutingDecisionRepository'),
  ReconciliationRepository: Symbol.for('ReconciliationRepository'),
  ComplianceCaseRepository: Symbol.for('ComplianceCaseRepository'),

  // Domain Services
  PaymentOrchestrationEngine: Symbol.for('PaymentOrchestrationEngine'),
  CashPositionService: Symbol.for('CashPositionService'),
  ComplianceEngine: Symbol.for('ComplianceEngine'),
  ReconciliationEngine: Symbol.for('ReconciliationEngine'),
  FXExposureService: Symbol.for('FXExposureService'),
  OperationsService: Symbol.for('OperationsService'),

  // External Service Adapters
  SanctionsListProvider: Symbol.for('SanctionsListProvider'),
  FXRateProvider: Symbol.for('FXRateProvider'),
  AccountDataSource: Symbol.for('AccountDataSource'),
  CashFlowSource: Symbol.for('CashFlowSource'),

  // Gateway Adapters
  ModernTreasuryAdapter: Symbol.for('ModernTreasuryAdapter'),
  PlaidAdapter: Symbol.for('PlaidAdapter'),
  BankGatewayRegistry: Symbol.for('BankGatewayRegistry'),

  // Application Services
  BankingTreasuryService: Symbol.for('BankingTreasuryService'),

  // Use Cases / Command Handlers
  CreateBankAccountHandler: Symbol.for('CreateBankAccountHandler'),
  UpdateBankAccountHandler: Symbol.for('UpdateBankAccountHandler'),
  ProcessPaymentHandler: Symbol.for('ProcessPaymentHandler'),
  ReconcileAccountHandler: Symbol.for('ReconcileAccountHandler'),

  // Query Handlers
  GetCashPositionHandler: Symbol.for('GetCashPositionHandler'),
  GetAccountBalanceHandler: Symbol.for('GetAccountBalanceHandler'),
  GetPaymentStatusHandler: Symbol.for('GetPaymentStatusHandler'),
} as const;

/**
 * Type for token keys
 */
export type TokenKey = keyof typeof TOKENS;

/**
 * Type-safe token accessor
 */
export function getToken(key: TokenKey): symbol {
  return TOKENS[key];
}
