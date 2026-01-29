/**
 * Payment Orchestration Types
 *
 * Types for the payment orchestration engine that coordinates
 * routing decisions, execution, and failover handling.
 *
 * @module services/payment-orchestration
 */

import type { Money } from '../../types/financial.js';
import type { PaymentRail, RailType } from '../../domain/value-objects/payment-rail.js';
import type { RoutingDecision, RailOption, UrgencyLevel } from '../../domain/value-objects/routing-decision.js';
import type { CutoffWindow, CutoffCheckResult } from '../../domain/value-objects/cutoff-window.js';

/**
 * Payment request for orchestration.
 */
export interface PaymentRequest {
  readonly paymentId: string;
  readonly sourceAccountId: string;
  readonly destinationAccountId?: string | undefined;
  readonly amount: Money;
  readonly beneficiary: PaymentBeneficiary;
  readonly urgency: UrgencyLevel;
  readonly requestedValueDate?: Date | undefined;
  readonly reference: string;
  readonly remittanceInfo?: string | undefined;
  readonly purposeCode?: string | undefined;
  readonly chargeBearer: 'OUR' | 'BEN' | 'SHA';
  readonly requiresManualReview: boolean;
  readonly complianceStatus?: ComplianceStatus | undefined;
  readonly metadata: Record<string, unknown>;
}

/**
 * Payment beneficiary details.
 */
export interface PaymentBeneficiary {
  readonly name: string;
  readonly accountNumber: string;
  readonly bankCode?: string | undefined;
  readonly swiftBic?: string | undefined;
  readonly iban?: string | undefined;
  readonly routingNumber?: string | undefined;
  readonly address?: BeneficiaryAddress | undefined;
  readonly country: string;
}

/**
 * Beneficiary address.
 */
export interface BeneficiaryAddress {
  readonly street?: string | undefined;
  readonly city?: string | undefined;
  readonly state?: string | undefined;
  readonly postalCode?: string | undefined;
  readonly country: string;
}

/**
 * Compliance screening status.
 */
export type ComplianceStatus = 'pending' | 'clear' | 'review_required' | 'blocked';

/**
 * Payment execution result.
 */
export interface PaymentExecutionResult {
  readonly paymentId: string;
  readonly success: boolean;
  readonly railId: string;
  readonly bankReference?: string | undefined;
  readonly trackingId?: string | undefined;
  readonly submittedAt: Date;
  readonly expectedSettlement?: Date | undefined;
  readonly failureCode?: string | undefined;
  readonly failureReason?: string | undefined;
  readonly usedFallback: boolean;
  readonly fallbackRailId?: string | undefined;
}

/**
 * Payment failure details.
 */
export interface PaymentFailure {
  readonly paymentId: string;
  readonly railId: string;
  readonly failureCode: string;
  readonly failureReason: string;
  readonly occurredAt: Date;
  readonly isRetryable: boolean;
  readonly suggestedAction: RecoveryAction;
}

/**
 * Recovery action after failure.
 */
export type RecoveryAction =
  | 'retry_same_rail'
  | 'try_fallback'
  | 'manual_intervention'
  | 'cancel'
  | 'wait_and_retry';

/**
 * Cutoff status for a rail.
 */
export interface CutoffStatus {
  readonly railId: string;
  readonly currency: string;
  readonly canMakeCutoff: boolean;
  readonly cutoffTime: Date;
  readonly minutesRemaining: number;
  readonly nextWindow?: Date | undefined;
  readonly isBusinessDay: boolean;
}

/**
 * Rail availability for routing.
 */
export interface RailAvailability {
  readonly railId: string;
  readonly railType: RailType;
  readonly isAvailable: boolean;
  readonly unavailabilityReason?: string | undefined;
  readonly cutoffStatus: CutoffStatus;
  readonly currentLatency?: number | undefined;
  readonly healthStatus: 'healthy' | 'degraded' | 'unavailable';
}

/**
 * Orchestration metrics.
 */
export interface OrchestrationMetrics {
  readonly totalRoutingDecisions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly fallbacksUsed: number;
  readonly averageRoutingTimeMs: number;
  readonly averageExecutionTimeMs: number;
  readonly railUsage: Map<string, number>;
  readonly failuresByCode: Map<string, number>;
}

/**
 * Rail execution adapter interface.
 */
export interface IRailExecutor {
  readonly railId: string;
  readonly railType: RailType;

  /**
   * Execute payment on this rail.
   */
  execute(request: PaymentRequest): Promise<PaymentExecutionResult>;

  /**
   * Get current status of a payment.
   */
  getStatus(bankReference: string): Promise<PaymentStatusUpdate>;

  /**
   * Check if rail is currently available.
   */
  checkAvailability(): Promise<RailAvailability>;

  /**
   * Get cutoff windows for this rail.
   */
  getCutoffs(currency: string, bankId: string): CutoffWindow[];
}

/**
 * Payment status update.
 */
export interface PaymentStatusUpdate {
  readonly paymentId: string;
  readonly bankReference: string;
  readonly status: 'pending' | 'processing' | 'completed' | 'failed' | 'returned';
  readonly updatedAt: Date;
  readonly settlementDate?: Date | undefined;
  readonly failureCode?: string | undefined;
  readonly failureReason?: string | undefined;
}
