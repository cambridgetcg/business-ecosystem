/**
 * Routing Decision Repository Interface
 *
 * Domain-level interface for routing decision persistence.
 * Provides audit trail for payment routing decisions.
 * Implementation resides in infrastructure layer.
 */

import type { RoutingDecision } from '../value-objects/routing-decision.js';

/**
 * Query options for routing decision searches.
 */
export interface RoutingDecisionQueryOptions {
  /** Filter by payment ID */
  paymentId?: string;
  /** Filter by selected rail ID */
  selectedRailId?: string;
  /** Filter by urgency level */
  urgencyLevel?: 'standard' | 'urgent' | 'critical';
  /** Start of date range */
  fromDate?: Date;
  /** End of date range */
  toDate?: Date;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Repository interface for RoutingDecision value objects.
 */
export interface RoutingDecisionRepository {
  /**
   * Find a routing decision by its unique identifier.
   */
  findById(id: string): Promise<RoutingDecision | null>;

  /**
   * Find the most recent routing decision for a payment.
   */
  findByPaymentId(paymentId: string): Promise<RoutingDecision | null>;

  /**
   * Find all routing decisions for a payment (history).
   */
  findAllByPaymentId(paymentId: string): Promise<RoutingDecision[]>;

  /**
   * Query routing decisions with filters.
   */
  query(options: RoutingDecisionQueryOptions): Promise<RoutingDecision[]>;

  /**
   * Count routing decisions matching filters.
   */
  count(options: Omit<RoutingDecisionQueryOptions, 'limit' | 'offset'>): Promise<number>;

  /**
   * Save a routing decision.
   * Note: Routing decisions are immutable once created.
   */
  save(decision: RoutingDecision): Promise<void>;

  /**
   * Delete a routing decision by ID.
   * Use with caution - typically decisions should be preserved for audit.
   */
  delete(id: string): Promise<void>;
}

/**
 * Analytics queries for routing decisions.
 */
export interface RoutingDecisionAnalytics {
  /**
   * Get rail usage statistics for a time period.
   */
  getRailUsageStats(
    fromDate: Date,
    toDate: Date
  ): Promise<Array<{
    railId: string;
    railType: string;
    totalSelections: number;
    totalFallbackSelections: number;
    averageCostScore: number;
    averageSpeedScore: number;
  }>>;

  /**
   * Get average routing scores by urgency level.
   */
  getScoresByUrgency(
    fromDate: Date,
    toDate: Date
  ): Promise<Array<{
    urgencyLevel: string;
    averageCostWeight: number;
    averageSpeedWeight: number;
    averageRiskWeight: number;
    decisionCount: number;
  }>>;
}
