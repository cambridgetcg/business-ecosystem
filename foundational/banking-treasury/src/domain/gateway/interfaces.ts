/**
 * Bank Gateway Interfaces
 *
 * Core interfaces for the Bank Gateway abstraction layer.
 * These define the contracts that all bank adapters must implement.
 *
 * @see docs/architecture/BANK_GATEWAY.md
 */

import type { Money } from '../../types/financial.js';
import type { PaymentRail } from '../value-objects/payment-rail.js';
import type {
  BankConnection,
  BankConnectionId,
  BankProvider,
  BankCapabilities,
  BalancePosition,
  AggregatedPosition,
  BalanceFreshness,
  PaymentParty,
  PaymentDirection,
  NextAvailableWindow,
  FXQuote,
  FXExecution,
  FXExposure,
  ScreeningResult,
  AMLAlert,
  BankTransaction,
  BankStatement,
  Asset,
  AssetType,
} from './types.js';

// =============================================================================
// BALANCE AGGREGATION SERVICE
// =============================================================================

/**
 * Query options for balance retrieval.
 */
export interface BalanceQueryOptions {
  /** Force fresh fetch even if cached data exists */
  readonly forceFresh?: boolean;
  /** Minimum acceptable freshness level */
  readonly minFreshness?: BalanceFreshness;
  /** Include pending transactions in calculation */
  readonly includePending?: boolean;
  /** Include hold details */
  readonly includeHolds?: boolean;
  /** Timeout for fetch operation in milliseconds */
  readonly timeoutMs?: number;
}

/**
 * Balance aggregation service interface.
 * Provides unified access to balances across all connected banks.
 */
export interface IBalanceAggregator {
  /**
   * Get balance for a single account.
   */
  getBalance(
    connectionId: BankConnectionId,
    options?: BalanceQueryOptions
  ): Promise<BalancePosition>;

  /**
   * Get balances for multiple accounts.
   */
  getBalances(
    connectionIds: BankConnectionId[],
    options?: BalanceQueryOptions
  ): Promise<BalancePosition[]>;

  /**
   * Get aggregated position for an entity across all accounts.
   */
  getAggregatedPosition(
    entityId: string,
    currency?: string,
    options?: BalanceQueryOptions
  ): Promise<AggregatedPosition>;

  /**
   * Get total available liquidity across all entities.
   */
  getTotalLiquidity(
    currency: string,
    options?: BalanceQueryOptions
  ): Promise<Money>;

  /**
   * Subscribe to real-time balance updates.
   */
  subscribeToUpdates(
    connectionIds: BankConnectionId[],
    callback: (position: BalancePosition) => void
  ): () => void; // Returns unsubscribe function

  /**
   * Get freshness status for all connections.
   */
  getFreshnessReport(): Promise<Map<BankConnectionId, BalanceFreshness>>;
}

// =============================================================================
// PAYMENT EXECUTION SERVICE
// =============================================================================

/**
 * Payment instruction for outbound payments.
 */
export interface PaymentInstruction {
  readonly instructionId: string;
  readonly sourceAccountId: string;
  readonly amount: Money;
  readonly beneficiary: PaymentParty;
  readonly preferredRail?: string;
  readonly urgency: 'standard' | 'urgent' | 'critical';
  readonly valueDate?: Date;           // Requested settlement date
  readonly reference: string;          // Payment reference
  readonly remittanceInfo?: string;    // Additional info for beneficiary
  readonly purposeCode?: string;       // ISO 20022 purpose code
  readonly chargeBearer?: 'OUR' | 'BEN' | 'SHA';
  readonly fxQuoteId?: string;         // Pre-agreed FX quote
  readonly metadata: Record<string, unknown>;
}

/**
 * Result of payment submission.
 */
export interface PaymentSubmissionResult {
  readonly instructionId: string;
  readonly bankReference: string;      // Bank's reference number
  readonly trackingId?: string;        // UETR or similar
  readonly status: PaymentExecutionStatus;
  readonly selectedRail: string;
  readonly estimatedSettlement: Date;
  readonly fees: Money;
  readonly fxRate?: number;
  readonly submittedAt: Date;
  readonly rawResponse?: unknown;
}

/**
 * Payment execution status.
 */
export type PaymentExecutionStatus =
  | 'accepted'             // Bank accepted for processing
  | 'pending_approval'     // Requires bank-side approval
  | 'processing'           // In flight
  | 'completed'            // Settled
  | 'rejected'             // Bank rejected
  | 'cancelled'            // Cancelled before processing
  | 'returned'             // Returned after settlement
  | 'failed';              // Technical failure

/**
 * Status update for a payment.
 */
export interface PaymentStatusUpdate {
  readonly instructionId: string;
  readonly bankReference: string;
  readonly previousStatus: PaymentExecutionStatus;
  readonly currentStatus: PaymentExecutionStatus;
  readonly updatedAt: Date;
  readonly reason?: string;
  readonly additionalInfo?: Record<string, unknown>;
}

/**
 * Payment recall request.
 */
export interface PaymentRecallRequest {
  readonly instructionId: string;
  readonly bankReference: string;
  readonly reason: 'duplicate' | 'fraud' | 'technical_error' | 'customer_request';
  readonly requestedBy: string;
}

/**
 * Payment recall result.
 */
export interface PaymentRecallResult {
  readonly recallId: string;
  readonly instructionId: string;
  readonly status: 'pending' | 'accepted' | 'rejected' | 'completed';
  readonly respondedAt?: Date;
  readonly rejectionReason?: string;
  readonly refundAmount?: Money;
}

/**
 * Payment execution service interface.
 * Handles outbound payment initiation and lifecycle management.
 */
export interface IPaymentExecutor {
  /**
   * Submit a payment instruction for execution.
   */
  submitPayment(
    instruction: PaymentInstruction,
    preScreeningResult?: ScreeningResult
  ): Promise<PaymentSubmissionResult>;

  /**
   * Get current status of a payment.
   */
  getPaymentStatus(instructionId: string): Promise<PaymentStatusUpdate>;

  /**
   * Subscribe to payment status updates.
   */
  subscribeToStatusUpdates(
    instructionIds: string[],
    callback: (update: PaymentStatusUpdate) => void
  ): () => void;

  /**
   * Request recall of a payment.
   */
  recallPayment(request: PaymentRecallRequest): Promise<PaymentRecallResult>;

  /**
   * Get recall status.
   */
  getRecallStatus(recallId: string): Promise<PaymentRecallResult>;

  /**
   * Validate payment instruction before submission.
   */
  validateInstruction(instruction: PaymentInstruction): Promise<PaymentValidationResult>;

  /**
   * Get available rails for a payment.
   */
  getAvailableRails(instruction: PaymentInstruction): Promise<RailOption[]>;

  /**
   * Get next available processing window for a payment.
   */
  getNextWindow(
    instruction: PaymentInstruction,
    railType?: string
  ): Promise<NextAvailableWindow>;
}

/**
 * Payment validation result.
 */
export interface PaymentValidationResult {
  readonly isValid: boolean;
  readonly errors: ValidationError[];
  readonly warnings: ValidationWarning[];
  readonly estimatedFees: Money;
  readonly estimatedSettlement: Date;
}

/**
 * Validation error detail.
 */
export interface ValidationError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

/**
 * Validation warning detail.
 */
export interface ValidationWarning {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

/**
 * Rail option for payment.
 */
export interface RailOption {
  readonly rail: PaymentRail;
  readonly isAvailableNow: boolean;
  readonly nextAvailable: Date;
  readonly estimatedCost: Money;
  readonly estimatedSettlement: Date;
  readonly riskScore: number;
  readonly recommendation: 'preferred' | 'alternative' | 'not_recommended';
  readonly unavailableReason?: string;
}

// =============================================================================
// INBOUND PAYMENT RECEIVER
// =============================================================================

/**
 * Inbound payment notification.
 */
export interface InboundPaymentNotification {
  readonly notificationId: string;
  readonly connectionId: BankConnectionId;
  readonly accountId: string;
  readonly amount: Money;
  readonly senderInfo: PaymentParty;
  readonly reference: string;
  readonly remittanceInfo?: string;
  readonly valueDate: Date;
  readonly receivedAt: Date;
  readonly rail: string;
  readonly isPending: boolean;
  readonly transactionId?: string;     // Bank's transaction ID
}

/**
 * Inbound payment receiver interface.
 * Handles notification and processing of incoming payments.
 */
export interface IPaymentReceiver {
  /**
   * Register handler for inbound payment notifications.
   */
  onPaymentReceived(
    callback: (notification: InboundPaymentNotification) => void
  ): () => void;

  /**
   * Get recent inbound payments.
   */
  getRecentInbound(
    connectionId: BankConnectionId,
    since: Date
  ): Promise<InboundPaymentNotification[]>;

  /**
   * Acknowledge processing of an inbound payment.
   */
  acknowledgePayment(notificationId: string): Promise<void>;
}

// =============================================================================
// FX SERVICE
// =============================================================================

/**
 * FX quote request.
 */
export interface FXQuoteRequest {
  readonly sourceCurrency: string;
  readonly targetCurrency: string;
  readonly amount: Money;
  readonly direction: 'buy' | 'sell';  // Buy or sell target currency
  readonly valueDate?: Date;
  readonly quoteValidityMinutes?: number;
}

/**
 * FX execution request.
 */
export interface FXExecutionRequest {
  readonly quoteId?: string;           // Execute against specific quote
  readonly sourceCurrency: string;
  readonly targetCurrency: string;
  readonly sourceAmount?: Money;       // Either source or target required
  readonly targetAmount?: Money;
  readonly valueDate: Date;
  readonly reference: string;
}

/**
 * FX service interface.
 * Handles foreign exchange quotes, execution, and exposure tracking.
 */
export interface IFXService {
  /**
   * Get indicative FX rate.
   */
  getIndicativeRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<number>;

  /**
   * Request executable FX quote.
   */
  requestQuote(request: FXQuoteRequest): Promise<FXQuote>;

  /**
   * Execute FX transaction.
   */
  executeFX(request: FXExecutionRequest): Promise<FXExecution>;

  /**
   * Get status of FX execution.
   */
  getFXStatus(executionId: string): Promise<FXExecution>;

  /**
   * Get current FX exposures.
   */
  getExposures(entityId?: string): Promise<FXExposure[]>;

  /**
   * Calculate net exposure by currency pair.
   */
  getNetExposure(currencyPair: string): Promise<Money>;

  /**
   * Get optimal execution window for FX.
   */
  getOptimalExecutionWindow(
    currencyPair: string,
    targetDate: Date
  ): Promise<NextAvailableWindow>;
}

// =============================================================================
// COMPLIANCE SCREENING SERVICE
// =============================================================================

/**
 * Screening request for compliance check.
 */
export interface ScreeningRequest {
  readonly requestId: string;
  readonly paymentId: string;
  readonly paymentDirection: PaymentDirection;
  readonly amount: Money;
  readonly parties: PaymentParty[];
  readonly sourceCountry: string;
  readonly destinationCountry: string;
  readonly purposeCode?: string;
  readonly urgency: 'standard' | 'urgent';
}

/**
 * Compliance screening service interface.
 * Handles AML, sanctions, and fraud screening.
 */
export interface IComplianceScreener {
  /**
   * Screen a payment before execution.
   */
  screenPayment(request: ScreeningRequest): Promise<ScreeningResult>;

  /**
   * Screen a party independently.
   */
  screenParty(party: PaymentParty): Promise<ScreeningResult>;

  /**
   * Re-screen against updated lists.
   */
  rescreenPayment(paymentId: string): Promise<ScreeningResult>;

  /**
   * Get screening result for a payment.
   */
  getScreeningResult(screeningId: string): Promise<ScreeningResult>;

  /**
   * Check if screening is still valid.
   */
  isScreeningValid(screeningId: string): Promise<boolean>;

  /**
   * Override screening decision (with audit).
   */
  overrideDecision(
    screeningId: string,
    newStatus: 'cleared' | 'blocked',
    reason: string,
    approvedBy: string
  ): Promise<ScreeningResult>;

  /**
   * Get active AML alerts.
   */
  getActiveAlerts(): Promise<AMLAlert[]>;

  /**
   * Update alert status.
   */
  updateAlertStatus(
    alertId: string,
    status: AMLAlert['status'],
    rationale?: string
  ): Promise<AMLAlert>;
}

// =============================================================================
// STATEMENT & RECONCILIATION SERVICE
// =============================================================================

/**
 * Statement retrieval options.
 */
export interface StatementRetrievalOptions {
  readonly format?: 'mt940' | 'bai2' | 'iso20022' | 'csv' | 'native';
  readonly includeIntraday?: boolean;
  readonly includePending?: boolean;
}

/**
 * Statement and transaction service interface.
 */
export interface IStatementService {
  /**
   * Get statement for a date range.
   */
  getStatement(
    connectionId: BankConnectionId,
    startDate: Date,
    endDate: Date,
    options?: StatementRetrievalOptions
  ): Promise<BankStatement>;

  /**
   * Get recent transactions (real-time if available).
   */
  getTransactions(
    connectionId: BankConnectionId,
    since: Date,
    limit?: number
  ): Promise<BankTransaction[]>;

  /**
   * Subscribe to real-time transaction notifications.
   */
  subscribeToTransactions(
    connectionId: BankConnectionId,
    callback: (transaction: BankTransaction) => void
  ): () => void;

  /**
   * Search transactions by criteria.
   */
  searchTransactions(
    connectionId: BankConnectionId,
    criteria: TransactionSearchCriteria
  ): Promise<BankTransaction[]>;
}

/**
 * Transaction search criteria.
 */
export interface TransactionSearchCriteria {
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly minAmount?: Money;
  readonly maxAmount?: Money;
  readonly direction?: PaymentDirection;
  readonly reference?: string;
  readonly counterpartyName?: string;
  readonly isPending?: boolean;
}

// =============================================================================
// BANK ADAPTER INTERFACE
// =============================================================================

/**
 * Bank adapter interface.
 * Each bank provider implements this interface.
 */
export interface IBankAdapter {
  /**
   * Provider identifier.
   */
  readonly provider: BankProvider;

  /**
   * Initialize connection with credentials.
   */
  connect(credentials: BankCredentials): Promise<BankConnection>;

  /**
   * Disconnect and cleanup resources.
   */
  disconnect(connectionId: BankConnectionId): Promise<void>;

  /**
   * Check connection health.
   */
  checkHealth(connectionId: BankConnectionId): Promise<ConnectionHealthCheck>;

  /**
   * Refresh credentials if needed (e.g., OAuth token refresh).
   */
  refreshCredentials(connectionId: BankConnectionId): Promise<void>;

  /**
   * Get capabilities for this connection.
   */
  getCapabilities(connectionId: BankConnectionId): Promise<BankCapabilities>;

  // Capability-specific methods (implementations may throw if not supported)

  /** Balance operations */
  getBalance(connectionId: BankConnectionId): Promise<BalancePosition>;

  /** Payment operations */
  submitPayment(
    connectionId: BankConnectionId,
    instruction: PaymentInstruction
  ): Promise<PaymentSubmissionResult>;

  getPaymentStatus(
    connectionId: BankConnectionId,
    bankReference: string
  ): Promise<PaymentStatusUpdate>;

  /** Statement operations */
  getStatement(
    connectionId: BankConnectionId,
    startDate: Date,
    endDate: Date
  ): Promise<BankStatement>;

  /** FX operations (if supported) */
  getFXQuote?(
    connectionId: BankConnectionId,
    request: FXQuoteRequest
  ): Promise<FXQuote>;

  executeFX?(
    connectionId: BankConnectionId,
    request: FXExecutionRequest
  ): Promise<FXExecution>;
}

/**
 * Bank credentials for authentication.
 */
export interface BankCredentials {
  readonly provider: BankProvider;
  readonly accountIdentifier: string;
  readonly credentials: Record<string, string>;  // Provider-specific
  readonly metadata?: Record<string, unknown>;
}

/**
 * Connection health check result.
 */
export interface ConnectionHealthCheck {
  readonly connectionId: BankConnectionId;
  readonly isHealthy: boolean;
  readonly latencyMs: number;
  readonly lastSuccessfulOperation: Date;
  readonly issues: string[];
  readonly checkedAt: Date;
}

// =============================================================================
// GATEWAY ORCHESTRATOR
// =============================================================================

/**
 * Bank Gateway orchestrator.
 * Central facade coordinating all gateway services.
 */
export interface IBankGateway {
  // Connection management
  readonly connections: IConnectionManager;

  // Core services
  readonly balances: IBalanceAggregator;
  readonly payments: IPaymentExecutor;
  readonly inbound: IPaymentReceiver;
  readonly fx: IFXService;
  readonly compliance: IComplianceScreener;
  readonly statements: IStatementService;

  /**
   * Execute a payment with full orchestration.
   * Includes: validation, screening, rail selection, execution, tracking.
   */
  executePayment(instruction: PaymentInstruction): Promise<PaymentSubmissionResult>;

  /**
   * Get comprehensive position report.
   */
  getPositionReport(entityId?: string): Promise<PositionReport>;

  /**
   * Health check across all services.
   */
  healthCheck(): Promise<GatewayHealthReport>;
}

/**
 * Connection manager interface.
 */
export interface IConnectionManager {
  /**
   * Add a new bank connection.
   */
  addConnection(credentials: BankCredentials): Promise<BankConnection>;

  /**
   * Remove a connection.
   */
  removeConnection(connectionId: BankConnectionId): Promise<void>;

  /**
   * Get all active connections.
   */
  getConnections(): Promise<BankConnection[]>;

  /**
   * Get connection by ID.
   */
  getConnection(connectionId: BankConnectionId): Promise<BankConnection>;

  /**
   * Get connections by entity.
   */
  getConnectionsByEntity(entityId: string): Promise<BankConnection[]>;

  /**
   * Update connection status.
   */
  updateStatus(
    connectionId: BankConnectionId,
    status: BankConnection['status']
  ): Promise<void>;
}

/**
 * Position report across all accounts.
 */
export interface PositionReport {
  readonly generatedAt: Date;
  readonly entityId?: string;
  readonly positions: AggregatedPosition[];
  readonly totalByCurrency: Map<string, Money>;
  readonly pendingPayments: Money;
  readonly pendingReceipts: Money;
  readonly fxExposures: FXExposure[];
  readonly dataFreshness: Map<BankConnectionId, BalanceFreshness>;
}

/**
 * Gateway health report.
 */
export interface GatewayHealthReport {
  readonly checkedAt: Date;
  readonly overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  readonly connections: ConnectionHealthCheck[];
  readonly services: ServiceHealthCheck[];
}

/**
 * Individual service health check.
 */
export interface ServiceHealthCheck {
  readonly service: string;
  readonly isHealthy: boolean;
  readonly latencyMs: number;
  readonly issues: string[];
}
