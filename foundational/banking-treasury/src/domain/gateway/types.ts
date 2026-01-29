/**
 * Bank Gateway Core Types
 *
 * Foundational types for the Bank Gateway abstraction layer.
 * These types define the vocabulary for interacting with external banking systems.
 *
 * @see docs/architecture/BANK_GATEWAY.md
 */

import type { Money } from '../../types/financial.js';

// =============================================================================
// BANK CONNECTION & CAPABILITIES
// =============================================================================

/**
 * Unique identifier for a bank connection.
 * Format: provider:bank_id:account_id (e.g., "plaid:chase:acct_123")
 */
export type BankConnectionId = string;

/**
 * Supported bank connection providers.
 */
export type BankProvider =
  | 'jpmorgan_direct'      // Direct J.P. Morgan API
  | 'bofa_direct'          // Direct Bank of America API
  | 'wells_direct'         // Direct Wells Fargo API
  | 'plaid'                // Plaid aggregator
  | 'mx'                   // MX aggregator
  | 'modern_treasury'      // Modern Treasury
  | 'stripe_treasury'      // Stripe Treasury
  | 'mercury'              // Mercury bank
  | 'swift'                // SWIFT network
  | 'manual';              // Manual/SFTP imports

/**
 * Connection health status.
 */
export type ConnectionStatus =
  | 'connected'            // Healthy, real-time data flowing
  | 'degraded'             // Partial functionality, some delays
  | 'reconnecting'         // Attempting to restore connection
  | 'disconnected'         // No connection, using cached data
  | 'expired'              // Credentials expired, requires re-auth
  | 'suspended';           // Suspended by bank or compliance

/**
 * Capabilities a bank connection may support.
 */
export interface BankCapabilities {
  /** Real-time balance via API or webhooks */
  readonly realTimeBalance: boolean;
  /** Push-based balance notifications (webhooks) */
  readonly webhookNotifications: boolean;
  /** Transaction history retrieval */
  readonly transactionHistory: boolean;
  /** Payment initiation capability */
  readonly paymentInitiation: boolean;
  /** Same-day payment execution */
  readonly sameDayPayments: boolean;
  /** Real-time payment rails (RTP, FedNow) */
  readonly realTimePayments: boolean;
  /** International wire capability */
  readonly internationalWires: boolean;
  /** FX conversion built-in */
  readonly fxConversion: boolean;
  /** Virtual account management */
  readonly virtualAccounts: boolean;
  /** Statement retrieval */
  readonly statements: boolean;
  /** Payment recall/cancellation */
  readonly paymentRecall: boolean;
  /** Tracking ID support (UETR, etc.) */
  readonly trackingIds: boolean;
}

/**
 * Rate limits imposed by the bank/provider.
 */
export interface RateLimits {
  /** Requests per minute for balance queries */
  readonly balanceRequestsPerMinute: number;
  /** Requests per minute for transaction queries */
  readonly transactionRequestsPerMinute: number;
  /** Payment submissions per hour */
  readonly paymentsPerHour: number;
  /** Concurrent connections allowed */
  readonly maxConcurrentConnections: number;
}

/**
 * Bank connection configuration.
 */
export interface BankConnection {
  readonly id: BankConnectionId;
  readonly provider: BankProvider;
  readonly bankName: string;
  readonly bankCode: string;              // SWIFT BIC or routing number
  readonly accountId: string;             // External account identifier
  readonly internalAccountId: string;     // Our bank_accounts.id reference
  readonly capabilities: BankCapabilities;
  readonly rateLimits: RateLimits;
  readonly status: ConnectionStatus;
  readonly lastSuccessfulSync: Date;
  readonly lastError?: BankConnectionError;
  readonly metadata: Record<string, unknown>;
}

/**
 * Connection error details.
 */
export interface BankConnectionError {
  readonly code: string;
  readonly message: string;
  readonly occurredAt: Date;
  readonly isRetryable: boolean;
  readonly retryAfter?: Date;
}

// =============================================================================
// BALANCE & AVAILABILITY
// =============================================================================

/**
 * Balance freshness indicator.
 */
export type BalanceFreshness =
  | 'real_time'            // <1 minute old, from webhook or real-time API
  | 'near_real_time'       // 1-5 minutes old
  | 'recent'               // 5-60 minutes old
  | 'stale'                // >1 hour old
  | 'unknown';             // Cannot determine freshness

/**
 * Types of balance holds.
 */
export type HoldType =
  | 'pending_debit'        // Outgoing payment in progress
  | 'pending_credit'       // Incoming payment not yet available
  | 'regulatory'           // Compliance/AML hold
  | 'dispute'              // Chargeback or dispute
  | 'collateral'           // Pledged as collateral
  | 'minimum_balance'      // Required minimum balance
  | 'other';

/**
 * A hold on available funds.
 */
export interface BalanceHold {
  readonly id: string;
  readonly type: HoldType;
  readonly amount: Money;
  readonly reason: string;
  readonly placedAt: Date;
  readonly expiresAt?: Date;
  readonly relatedTransactionId?: string;
}

/**
 * Comprehensive balance position for an account.
 */
export interface BalancePosition {
  readonly connectionId: BankConnectionId;
  readonly accountId: string;

  /** Ledger balance (all posted transactions) */
  readonly ledgerBalance: Money;

  /** Available balance (ledger - holds + pending credits) */
  readonly availableBalance: Money;

  /** Pending inbound credits not yet posted */
  readonly pendingCredits: Money;

  /** Pending outbound debits not yet posted */
  readonly pendingDebits: Money;

  /** Total holds on the account */
  readonly totalHolds: Money;

  /** Individual hold details */
  readonly holds: BalanceHold[];

  /** When the bank reported this balance */
  readonly asOfTimestamp: Date;

  /** When we fetched this balance */
  readonly fetchedAt: Date;

  /** Freshness assessment */
  readonly freshness: BalanceFreshness;

  /** Next expected update time */
  readonly nextUpdateExpected?: Date;
}

/**
 * Aggregated position across multiple accounts.
 */
export interface AggregatedPosition {
  readonly entityId: string;
  readonly currency: string;
  readonly positions: BalancePosition[];
  readonly totalLedger: Money;
  readonly totalAvailable: Money;
  readonly totalPendingIn: Money;
  readonly totalPendingOut: Money;
  readonly aggregatedAt: Date;
  readonly worstFreshness: BalanceFreshness;
}

// =============================================================================
// ASSET TYPES & INSTRUMENTS
// =============================================================================

/**
 * Asset types the gateway can handle.
 */
export type AssetType =
  | 'fiat'                 // Traditional fiat currency
  | 'stablecoin'           // USDC, USDT, etc.
  | 'money_market'         // Money market fund shares
  | 'commercial_paper';    // Short-term commercial paper

/**
 * Asset with type classification.
 */
export interface Asset {
  readonly type: AssetType;
  readonly code: string;              // Currency code or asset identifier
  readonly name: string;
  readonly issuer?: string;           // For stablecoins: Circle, Tether, etc.
  readonly decimals: number;
  readonly isRedeemable: boolean;     // Can convert to fiat
  readonly redemptionDelay?: number;  // Minutes to convert to fiat
}

// =============================================================================
// PAYMENT DIRECTION & PARTIES
// =============================================================================

/**
 * Payment direction from our perspective.
 */
export type PaymentDirection =
  | 'outbound'             // We are sending
  | 'inbound';             // We are receiving

/**
 * Party in a payment transaction.
 */
export interface PaymentParty {
  readonly name: string;
  readonly accountNumber: string;
  readonly routingNumber?: string;
  readonly iban?: string;
  readonly swiftBic?: string;
  readonly bankName: string;
  readonly bankAddress?: Address;
  readonly partyAddress?: Address;
  readonly partyType: 'individual' | 'business';
  readonly countryCode: string;        // ISO 3166-1 alpha-2
}

/**
 * Address structure.
 */
export interface Address {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly region?: string;
  readonly postalCode?: string;
  readonly countryCode: string;
}

// =============================================================================
// TIMING & AVAILABILITY WINDOWS
// =============================================================================

/**
 * Operating window for bank services.
 */
export interface OperatingWindow {
  readonly dayOfWeek: number;          // 0=Sunday, 6=Saturday
  readonly opensAt: string;            // HH:MM in timezone
  readonly closesAt: string;           // HH:MM in timezone
  readonly timezone: string;           // IANA timezone
  readonly cutoffBuffer: number;       // Minutes before close for last submission
}

/**
 * Bank holiday affecting operations.
 */
export interface BankHoliday {
  readonly date: string;               // YYYY-MM-DD
  readonly name: string;
  readonly affectedServices: ('balance' | 'payments' | 'fx' | 'all')[];
  readonly countryCode: string;
}

/**
 * Next available processing window.
 */
export interface NextAvailableWindow {
  readonly opensAt: Date;
  readonly closesAt: Date;
  readonly cutoffAt: Date;             // Last submission time
  readonly isCurrentlyOpen: boolean;
  readonly reason?: string;            // Why closed (holiday, weekend, etc.)
}

// =============================================================================
// FX & CURRENCY CONVERSION
// =============================================================================

/**
 * FX quote from a bank or provider.
 */
export interface FXQuote {
  readonly quoteId: string;
  readonly provider: BankProvider;
  readonly sourceCurrency: string;
  readonly targetCurrency: string;
  readonly rate: number;               // Units of target per unit of source
  readonly inverseRate: number;
  readonly sourceAmount: Money;
  readonly targetAmount: Money;
  readonly spread: number;             // Percentage spread from mid-market
  readonly validFrom: Date;
  readonly validUntil: Date;
  readonly settlementDate: Date;
  readonly isIndicative: boolean;      // True if not executable
}

/**
 * FX execution result.
 */
export interface FXExecution {
  readonly executionId: string;
  readonly quoteId?: string;           // If executed against a quote
  readonly sourceCurrency: string;
  readonly targetCurrency: string;
  readonly sourceAmount: Money;
  readonly targetAmount: Money;
  readonly executedRate: number;
  readonly executedAt: Date;
  readonly settlementDate: Date;
  readonly status: 'pending' | 'settled' | 'failed' | 'cancelled';
  readonly reference: string;
}

/**
 * FX exposure for tracking.
 */
export interface FXExposure {
  readonly entityId: string;
  readonly currencyPair: string;       // "EUR/USD" format
  readonly exposureType: 'receivable' | 'payable' | 'forecast';
  readonly amount: Money;
  readonly expectedSettlement: Date;
  readonly certaintyLevel: 'committed' | 'forecast' | 'estimate';
  readonly hedgeDesignation?: string;
  readonly naturalHedgeMatchId?: string;
}

// =============================================================================
// COMPLIANCE & AML
// =============================================================================

/**
 * AML screening status.
 */
export type ScreeningStatus =
  | 'pending'              // Not yet screened
  | 'cleared'              // Passed all checks
  | 'flagged'              // Requires review
  | 'blocked'              // Failed screening
  | 'escalated';           // Sent for manual review

/**
 * Screening result from compliance check.
 */
export interface ScreeningResult {
  readonly screeningId: string;
  readonly paymentId: string;
  readonly status: ScreeningStatus;
  readonly screenedAt: Date;
  readonly provider: string;           // Compliance provider name
  readonly checks: ComplianceCheck[];
  readonly overallRiskScore: number;   // 0-100
  readonly requiresManualReview: boolean;
  readonly blockedReason?: string;
  readonly expiresAt: Date;            // When re-screening required
}

/**
 * Individual compliance check.
 */
export interface ComplianceCheck {
  readonly checkType: ComplianceCheckType;
  readonly status: 'pass' | 'fail' | 'review';
  readonly score: number;
  readonly matches: ComplianceMatch[];
  readonly checkedAt: Date;
}

/**
 * Types of compliance checks.
 */
export type ComplianceCheckType =
  | 'ofac_sdn'             // US OFAC SDN list
  | 'ofac_consolidated'    // US OFAC consolidated list
  | 'eu_sanctions'         // EU consolidated sanctions
  | 'un_sanctions'         // UN sanctions list
  | 'pep'                  // Politically Exposed Persons
  | 'adverse_media'        // Negative news screening
  | 'fatf_jurisdiction'    // FATF grey/black list countries
  | 'aml_risk'             // General AML risk scoring
  | 'fraud_risk';          // Fraud pattern detection

/**
 * A match from compliance screening.
 */
export interface ComplianceMatch {
  readonly listName: string;
  readonly matchedName: string;
  readonly matchScore: number;         // 0-100 confidence
  readonly matchType: 'exact' | 'fuzzy' | 'alias';
  readonly listDate: Date;
  readonly details: Record<string, unknown>;
}

/**
 * AML alert requiring attention.
 */
export interface AMLAlert {
  readonly alertId: string;
  readonly triggerRule: string;
  readonly paymentId?: string;
  readonly customerId: string;
  readonly totalAmount: Money;
  readonly riskScore: number;
  readonly status: 'new' | 'assigned' | 'investigating' | 'closed_no_sar' | 'sar_filed';
  readonly createdAt: Date;
  readonly assignedTo?: string;
  readonly decisionRationale?: string;
  readonly sarReference?: string;
}

// =============================================================================
// TRANSACTION & STATEMENT TYPES
// =============================================================================

/**
 * Bank transaction from statement or real-time feed.
 */
export interface BankTransaction {
  readonly transactionId: string;
  readonly connectionId: BankConnectionId;
  readonly accountId: string;
  readonly direction: PaymentDirection;
  readonly amount: Money;
  readonly postedDate: Date;
  readonly valueDate: Date;
  readonly description: string;
  readonly reference: string;
  readonly counterparty?: PaymentParty | undefined;
  readonly category?: string | undefined;
  readonly isPending: boolean;
  readonly metadata: Record<string, unknown>;
}

/**
 * Bank statement for reconciliation.
 */
export interface BankStatement {
  readonly statementId: string;
  readonly connectionId: BankConnectionId;
  readonly accountId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly openingBalance: Money;
  readonly closingBalance: Money;
  readonly transactions: BankTransaction[];
  readonly retrievedAt: Date;
  readonly format: 'mt940' | 'bai2' | 'iso20022' | 'csv' | 'ofx' | 'api';
}
