/**
 * Payment Orchestration Engine
 *
 * Coordinates payment routing decisions, execution, and failover handling.
 * Implements multi-rail routing with cost/speed/risk optimization.
 *
 * @see docs/research/nuances/19_MULTI_RAIL_ORCHESTRATION.md
 * @module services/payment-orchestration
 */

import type { PaymentRail, RailType } from '../../domain/value-objects/payment-rail.js';
import {
  isRailAvailable,
  railSupportsCorridor,
  calculateRailCost,
} from '../../domain/value-objects/payment-rail.js';
import type { RoutingDecision, UrgencyLevel, ScoreWeights, RailOption } from '../../domain/value-objects/routing-decision.js';
import {
  createRoutingDecision,
  DEFAULT_SCORE_WEIGHTS,
  calculateTotalScore,
  calculateCostScore,
  calculateSpeedScore,
  calculateRiskScore,
} from '../../domain/value-objects/routing-decision.js';
import type { CutoffWindow, HolidayCalendar } from '../../domain/value-objects/cutoff-window.js';
import { checkCutoff } from '../../domain/value-objects/cutoff-window.js';
import type {
  PaymentRequest,
  PaymentExecutionResult,
  PaymentFailure,
  RecoveryAction,
  CutoffStatus,
  RailAvailability,
  IRailExecutor,
  OrchestrationMetrics,
} from './types.js';

/**
 * Mutable metrics tracker (internal use only).
 */
interface MutableMetrics {
  totalRoutingDecisions: number;
  successfulExecutions: number;
  failedExecutions: number;
  fallbacksUsed: number;
  averageRoutingTimeMs: number;
  averageExecutionTimeMs: number;
  railUsage: Map<string, number>;
  failuresByCode: Map<string, number>;
}

/**
 * Payment Orchestration Engine
 *
 * Provides intelligent payment routing across multiple rails with:
 * - Cost/speed/risk optimization
 * - Cutoff awareness
 * - Automatic failover
 * - Compliance integration
 */
export class PaymentOrchestrationEngine {
  private readonly railExecutors: Map<string, IRailExecutor> = new Map();
  private readonly paymentRails: Map<string, PaymentRail> = new Map();
  private readonly cutoffWindows: Map<string, CutoffWindow[]> = new Map();
  private readonly holidayCalendars: Map<string, HolidayCalendar> = new Map();
  private readonly mutableMetrics: MutableMetrics;

  constructor() {
    this.mutableMetrics = {
      totalRoutingDecisions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      fallbacksUsed: 0,
      averageRoutingTimeMs: 0,
      averageExecutionTimeMs: 0,
      railUsage: new Map(),
      failuresByCode: new Map(),
    };
  }

  /**
   * Register a rail executor.
   */
  registerRailExecutor(executor: IRailExecutor): void {
    this.railExecutors.set(executor.railId, executor);
  }

  /**
   * Register a payment rail configuration.
   */
  registerPaymentRail(rail: PaymentRail): void {
    this.paymentRails.set(rail.id, rail);
  }

  /**
   * Register cutoff windows for a bank/rail combination.
   */
  registerCutoffWindows(bankId: string, windows: CutoffWindow[]): void {
    this.cutoffWindows.set(bankId, windows);
  }

  /**
   * Register a holiday calendar.
   */
  registerHolidayCalendar(calendar: HolidayCalendar): void {
    this.holidayCalendars.set(calendar.id, calendar);
  }

  /**
   * Route a payment request to the optimal rail.
   */
  async route(request: PaymentRequest): Promise<RoutingDecision> {
    const startTime = Date.now();

    // 1. Get all available rails
    const allRails = Array.from(this.paymentRails.values());

    // 2. Filter by compliance
    const compliantRails = await this.filterByCompliance(allRails, request);

    // 3. Filter by capability (can reach destination)
    const capableRails = this.filterByCapability(compliantRails, request);

    // 4. Filter by cutoff (can make today's cutoff)
    const availableRails = await this.filterByCutoff(capableRails, request);

    // 5. Score remaining options
    const scoredOptions = this.scoreOptions(availableRails, request);

    // 6. Create routing decision
    const weights = this.getWeightsForUrgency(request.urgency);
    const decision = createRoutingDecision(
      this.generateDecisionId(),
      request.paymentId,
      request.urgency,
      scoredOptions,
      weights
    );

    // Update metrics
    this.updateRoutingMetrics(Date.now() - startTime);

    return decision;
  }

  /**
   * Execute a payment with the routing decision.
   */
  async execute(
    request: PaymentRequest,
    decision: RoutingDecision
  ): Promise<PaymentExecutionResult> {
    const startTime = Date.now();

    // Try primary rail
    const primaryResult = await this.executeOnRail(
      request,
      decision.selectedRailId
    );

    if (primaryResult.success) {
      this.updateExecutionMetrics(Date.now() - startTime, true, false);
      return primaryResult;
    }

    // Try fallback if available and primary failed
    if (decision.fallbackRailId && this.shouldTryFallback(primaryResult)) {
      const fallbackResult = await this.executeOnRail(
        request,
        decision.fallbackRailId
      );

      this.updateExecutionMetrics(Date.now() - startTime, fallbackResult.success, true);

      return {
        ...fallbackResult,
        usedFallback: true,
        fallbackRailId: decision.fallbackRailId,
      };
    }

    this.updateExecutionMetrics(Date.now() - startTime, false, false);
    return primaryResult;
  }

  /**
   * Handle a payment failure and determine recovery action.
   */
  async handleFailure(failure: PaymentFailure): Promise<RecoveryAction> {
    // Track failure metrics
    const current = this.mutableMetrics.failuresByCode.get(failure.failureCode) ?? 0;
    this.mutableMetrics.failuresByCode.set(failure.failureCode, current + 1);

    // Determine recovery based on failure type
    if (failure.isRetryable) {
      // Check if we can retry on the same rail
      const rail = this.paymentRails.get(failure.railId);
      if (rail) {
        const availability = await this.checkRailAvailability(rail);
        if (availability.isAvailable && availability.cutoffStatus.canMakeCutoff) {
          return 'retry_same_rail';
        }
      }

      // Try fallback
      return 'try_fallback';
    }

    // Non-retryable errors
    if (this.isComplianceFailure(failure.failureCode)) {
      return 'manual_intervention';
    }

    if (this.isTemporaryFailure(failure.failureCode)) {
      return 'wait_and_retry';
    }

    return 'cancel';
  }

  /**
   * Check cutoff status for a specific rail and currency.
   */
  checkCutoffStatus(
    railId: string,
    currency: string,
    bankId: string
  ): CutoffStatus {
    const windows = this.cutoffWindows.get(bankId) ?? [];
    const window = windows.find(
      w => w.railId === railId && w.currency === currency
    );

    if (!window) {
      return {
        railId,
        currency,
        canMakeCutoff: false,
        cutoffTime: new Date(),
        minutesRemaining: 0,
        isBusinessDay: true,
      };
    }

    const calendar = this.holidayCalendars.get(window.holidayCalendarId);
    const result = checkCutoff(window, calendar);

    return {
      railId,
      currency,
      canMakeCutoff: !result.cutoffPassed,
      cutoffTime: result.cutoffTime,
      minutesRemaining: result.minutesRemaining,
      nextWindow: result.nextCutoff,
      isBusinessDay: result.isBusinessDay,
    };
  }

  /**
   * Get current metrics.
   */
  getMetrics(): OrchestrationMetrics {
    return {
      totalRoutingDecisions: this.mutableMetrics.totalRoutingDecisions,
      successfulExecutions: this.mutableMetrics.successfulExecutions,
      failedExecutions: this.mutableMetrics.failedExecutions,
      fallbacksUsed: this.mutableMetrics.fallbacksUsed,
      averageRoutingTimeMs: this.mutableMetrics.averageRoutingTimeMs,
      averageExecutionTimeMs: this.mutableMetrics.averageExecutionTimeMs,
      railUsage: new Map(this.mutableMetrics.railUsage),
      failuresByCode: new Map(this.mutableMetrics.failuresByCode),
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async filterByCompliance(
    rails: PaymentRail[],
    request: PaymentRequest
  ): Promise<PaymentRail[]> {
    // Filter out rails that can't handle the compliance status
    if (request.complianceStatus === 'blocked') {
      return []; // No rails can process blocked payments
    }

    if (request.complianceStatus === 'review_required') {
      // Only certain rails support pending compliance
      // For now, allow all rails - in production would check rail config
      return rails;
    }

    return rails;
  }

  private filterByCapability(
    rails: PaymentRail[],
    request: PaymentRequest
  ): PaymentRail[] {
    return rails.filter(rail => {
      // Check corridor support (currency and country)
      const destCountry = request.beneficiary.country;
      const destCurrency = request.amount.currency;

      if (!railSupportsCorridor(rail, request.amount.currency, destCurrency, undefined, destCountry)) {
        return false;
      }

      // Check amount limits
      if (rail.maxAmount && request.amount.amount > rail.maxAmount.amount) {
        return false;
      }

      return true;
    });
  }

  private async filterByCutoff(
    rails: PaymentRail[],
    request: PaymentRequest
  ): Promise<PaymentRail[]> {
    const available: PaymentRail[] = [];
    const now = new Date();

    for (const rail of rails) {
      // Check basic availability
      if (!isRailAvailable(rail, now)) {
        continue;
      }

      // Check cutoff for requested value date
      const cutoffStatus = this.checkCutoffStatus(
        rail.id,
        request.amount.currency,
        'default' // TODO: Get actual bank ID from source account
      );

      if (cutoffStatus.canMakeCutoff || request.urgency === 'critical') {
        available.push(rail);
      }
    }

    return available;
  }

  private scoreOptions(
    rails: PaymentRail[],
    request: PaymentRequest
  ): RailOption[] {
    const weights = this.getWeightsForUrgency(request.urgency);

    return rails.map(rail => {
      // Calculate estimated cost
      const estimatedCost = calculateRailCost(rail, request.amount);

      // Calculate scores using the routing-decision functions
      const costScore = calculateCostScore(estimatedCost, request.amount);

      // Average settlement time for speed score
      const avgSettlement = Math.round((rail.minSettlementMinutes + rail.maxSettlementMinutes) / 2);
      const speedScore = calculateSpeedScore(avgSettlement);

      // Risk score based on availability and features
      const riskScore = calculateRiskScore(
        rail.status === 'active' ? 'available' : rail.status === 'degraded' ? 'degraded' : 'unavailable',
        'clear', // Assuming compliance passed
        rail.supportsRecall,
        rail.supportsTracking
      );

      const totalScore = calculateTotalScore(costScore, speedScore, riskScore, weights);

      return {
        railId: rail.id,
        railType: rail.type,
        estimatedCost,
        estimatedSettlementMinutes: avgSettlement,
        availabilityStatus: 'available' as const,
        complianceStatus: 'clear' as const,
        costScore,
        speedScore,
        riskScore,
        totalScore,
      };
    });
  }

  private async executeOnRail(
    request: PaymentRequest,
    railId: string
  ): Promise<PaymentExecutionResult> {
    const executor = this.railExecutors.get(railId);

    if (!executor) {
      return {
        paymentId: request.paymentId,
        success: false,
        railId,
        submittedAt: new Date(),
        failureCode: 'RAIL_NOT_CONFIGURED',
        failureReason: `No executor configured for rail ${railId}`,
        usedFallback: false,
      };
    }

    try {
      const result = await executor.execute(request);

      // Track rail usage
      const current = this.mutableMetrics.railUsage.get(railId) ?? 0;
      this.mutableMetrics.railUsage.set(railId, current + 1);

      return result;
    } catch (error) {
      return {
        paymentId: request.paymentId,
        success: false,
        railId,
        submittedAt: new Date(),
        failureCode: 'EXECUTION_ERROR',
        failureReason: error instanceof Error ? error.message : 'Unknown error',
        usedFallback: false,
      };
    }
  }

  private async checkRailAvailability(rail: PaymentRail): Promise<RailAvailability> {
    const executor = this.railExecutors.get(rail.id);

    if (executor) {
      return executor.checkAvailability();
    }

    // Default availability check
    const now = new Date();
    const isAvailable = isRailAvailable(rail, now);

    return {
      railId: rail.id,
      railType: rail.type,
      isAvailable,
      unavailabilityReason: isAvailable ? undefined : 'Outside operating hours',
      cutoffStatus: this.checkCutoffStatus(rail.id, 'USD', 'default'),
      healthStatus: isAvailable ? 'healthy' : 'unavailable',
    };
  }

  private shouldTryFallback(result: PaymentExecutionResult): boolean {
    // Don't retry compliance failures
    if (result.failureCode === 'COMPLIANCE_BLOCK') {
      return false;
    }

    // Don't retry insufficient funds
    if (result.failureCode === 'INSUFFICIENT_FUNDS') {
      return false;
    }

    // Retry transient failures
    const retryableCodes = [
      'TIMEOUT',
      'CUTOFF_MISSED',
      'RAIL_UNAVAILABLE',
      'EXECUTION_ERROR',
    ];

    return result.failureCode !== undefined &&
      retryableCodes.includes(result.failureCode);
  }

  private isComplianceFailure(code: string): boolean {
    return ['COMPLIANCE_BLOCK', 'SANCTIONS_HIT', 'PEP_HIT'].includes(code);
  }

  private isTemporaryFailure(code: string): boolean {
    return ['TIMEOUT', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE'].includes(code);
  }

  private getWeightsForUrgency(urgency: UrgencyLevel): ScoreWeights {
    return DEFAULT_SCORE_WEIGHTS[urgency];
  }

  private generateDecisionId(): string {
    return `rd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private updateRoutingMetrics(durationMs: number): void {
    this.mutableMetrics.totalRoutingDecisions++;
    // Running average
    const n = this.mutableMetrics.totalRoutingDecisions;
    this.mutableMetrics.averageRoutingTimeMs =
      ((n - 1) * this.mutableMetrics.averageRoutingTimeMs + durationMs) / n;
  }

  private updateExecutionMetrics(
    durationMs: number,
    success: boolean,
    usedFallback: boolean
  ): void {
    if (success) {
      this.mutableMetrics.successfulExecutions++;
    } else {
      this.mutableMetrics.failedExecutions++;
    }

    if (usedFallback) {
      this.mutableMetrics.fallbacksUsed++;
    }

    // Running average
    const n = this.mutableMetrics.successfulExecutions + this.mutableMetrics.failedExecutions;
    this.mutableMetrics.averageExecutionTimeMs =
      ((n - 1) * this.mutableMetrics.averageExecutionTimeMs + durationMs) / n;
  }
}
