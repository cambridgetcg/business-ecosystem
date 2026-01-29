/**
 * Routing Decision Value Object
 *
 * Represents a payment routing decision made by the orchestration engine.
 * Captures all considered options, scoring, and the selection rationale.
 * Essential for audit trail and optimization analytics.
 *
 * @see docs/research/nuances/19_MULTI_RAIL_ORCHESTRATION.md
 */

import type { Money } from '../../types/financial.js';
import type { RailType } from './payment-rail.js';

/**
 * Availability status of a rail at decision time.
 */
export type RailAvailabilityStatus = 'available' | 'degraded' | 'unavailable';

/**
 * Compliance screening result for a rail option.
 */
export type ComplianceStatus = 'clear' | 'review_required' | 'blocked';

/**
 * A single rail option considered during routing.
 * Contains all factors that went into the scoring.
 */
export interface RailOption {
  /** Rail identifier */
  railId: string;
  /** Rail type for quick reference */
  railType: RailType;
  /** Estimated total cost (fees + FX spread) */
  estimatedCost: Money;
  /** Estimated settlement time in minutes */
  estimatedSettlementMinutes: number;
  /** Rail availability at decision time */
  availabilityStatus: RailAvailabilityStatus;
  /** Compliance screening result */
  complianceStatus: ComplianceStatus;
  /** Cost score (0-100, higher is better/cheaper) */
  costScore: number;
  /** Speed score (0-100, higher is faster) */
  speedScore: number;
  /** Risk score (0-100, higher is lower risk) */
  riskScore: number;
  /** Weighted total score */
  totalScore: number;
  /** If disqualified, the reason */
  disqualificationReason?: string | undefined;
}

/**
 * Urgency level for payment routing.
 * Affects score weighting (urgent = speed weighted higher).
 */
export type UrgencyLevel = 'standard' | 'urgent' | 'critical';

/**
 * Score weights for routing decision.
 * Must sum to 1.0.
 */
export interface ScoreWeights {
  /** Weight for cost score */
  cost: number;
  /** Weight for speed score */
  speed: number;
  /** Weight for risk score */
  risk: number;
}

/**
 * Routing Decision value object.
 * Immutable record of a routing decision for audit and analytics.
 */
export interface RoutingDecision {
  /** Unique identifier */
  readonly id: string;
  /** Payment being routed */
  readonly paymentId: string;
  /** When decision was made */
  readonly decisionTimestamp: Date;
  /** Payment urgency level */
  readonly urgencyLevel: UrgencyLevel;
  /** All rails considered with their scores */
  readonly optionsConsidered: RailOption[];
  /** Selected rail ID */
  readonly selectedRailId: string;
  /** Human-readable selection reason */
  readonly selectionReason: string;
  /** Fallback rail if primary fails */
  readonly fallbackRailId?: string | undefined;
  /** Weights used for scoring */
  readonly scoreWeights: ScoreWeights;
}

/**
 * Default score weights by urgency level.
 * Standard: cost-optimized
 * Urgent: speed-optimized
 * Critical: speed-maximized
 */
export const DEFAULT_SCORE_WEIGHTS: Record<UrgencyLevel, ScoreWeights> = {
  standard: { cost: 0.5, speed: 0.3, risk: 0.2 },
  urgent: { cost: 0.2, speed: 0.6, risk: 0.2 },
  critical: { cost: 0.1, speed: 0.7, risk: 0.2 },
};

/**
 * Calculate weighted total score for a rail option.
 */
export function calculateTotalScore(
  costScore: number,
  speedScore: number,
  riskScore: number,
  weights: ScoreWeights
): number {
  return costScore * weights.cost + speedScore * weights.speed + riskScore * weights.risk;
}

/**
 * Calculate cost score (0-100).
 * Lower cost = higher score.
 */
export function calculateCostScore(estimatedCost: Money, paymentAmount: Money): number {
  // Cost as percentage of payment amount
  const costPercentage = (estimatedCost.amount / paymentAmount.amount) * 100;

  // Score: 100 for free, decreases as cost percentage increases
  // At 5% cost, score is 0
  const score = Math.max(0, 100 - costPercentage * 20);

  return Math.round(score);
}

/**
 * Calculate speed score (0-100).
 * Faster settlement = higher score.
 */
export function calculateSpeedScore(settlementMinutes: number): number {
  // Instant (<=1 min) = 100
  // Same day (<=480 min / 8 hours) = 70
  // Next day (<=1440 min / 24 hours) = 50
  // 2-3 days = 30
  // More = 10

  if (settlementMinutes <= 1) return 100;
  if (settlementMinutes <= 60) return 90;
  if (settlementMinutes <= 480) return 70;
  if (settlementMinutes <= 1440) return 50;
  if (settlementMinutes <= 4320) return 30;
  return 10;
}

/**
 * Calculate risk score (0-100).
 * Lower risk = higher score.
 */
export function calculateRiskScore(
  availabilityStatus: RailAvailabilityStatus,
  complianceStatus: ComplianceStatus,
  supportsRecall: boolean,
  supportsTracking: boolean
): number {
  let score = 100;

  // Availability penalty
  if (availabilityStatus === 'degraded') score -= 20;
  if (availabilityStatus === 'unavailable') score -= 100;

  // Compliance penalty
  if (complianceStatus === 'review_required') score -= 30;
  if (complianceStatus === 'blocked') score -= 100;

  // Bonus for recall support (reversibility)
  if (supportsRecall) score += 5;

  // Bonus for tracking
  if (supportsTracking) score += 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Get the best fallback rail from options.
 * Excludes the selected rail and disqualified options.
 */
export function selectFallbackRail(
  options: RailOption[],
  selectedRailId: string
): string | undefined {
  const fallbackOptions = options
    .filter((opt) => opt.railId !== selectedRailId && !opt.disqualificationReason)
    .sort((a, b) => b.totalScore - a.totalScore);

  return fallbackOptions[0]?.railId;
}

/**
 * Generate human-readable selection reason.
 */
export function generateSelectionReason(
  selected: RailOption,
  urgency: UrgencyLevel,
  weights: ScoreWeights
): string {
  const parts: string[] = [];

  // Note urgency if not standard
  if (urgency === 'critical') {
    parts.push('Critical urgency prioritized speed.');
  } else if (urgency === 'urgent') {
    parts.push('Urgent payment weighted toward speed.');
  }

  // Note top scoring factor
  const scores = [
    { name: 'cost', score: selected.costScore, weight: weights.cost },
    { name: 'speed', score: selected.speedScore, weight: weights.speed },
    { name: 'risk', score: selected.riskScore, weight: weights.risk },
  ].sort((a, b) => b.score * b.weight - a.score * a.weight);

  const topFactor = scores[0];
  if (topFactor && topFactor.name === 'cost') {
    parts.push(`Best cost efficiency (${selected.estimatedCost.currency} ${selected.estimatedCost.amount.toFixed(2)}).`);
  } else if (topFactor && topFactor.name === 'speed') {
    parts.push(`Fastest settlement (~${selected.estimatedSettlementMinutes} min).`);
  } else {
    parts.push(`Lowest risk profile.`);
  }

  // Note rail type
  parts.push(`Selected ${selected.railType} rail.`);

  return parts.join(' ');
}

/**
 * Create a new routing decision.
 */
export function createRoutingDecision(
  id: string,
  paymentId: string,
  urgencyLevel: UrgencyLevel,
  options: RailOption[],
  weights?: ScoreWeights
): RoutingDecision {
  const effectiveWeights = weights ?? DEFAULT_SCORE_WEIGHTS[urgencyLevel];

  // Sort by total score descending
  const sortedOptions = [...options].sort((a, b) => b.totalScore - a.totalScore);

  // Select best qualified option
  const qualifiedOptions = sortedOptions.filter((opt) => !opt.disqualificationReason);

  if (qualifiedOptions.length === 0) {
    throw new Error('No qualified rail options available for routing');
  }

  const selected = qualifiedOptions[0];
  if (!selected) {
    throw new Error('No qualified rail options available for routing');
  }
  const fallbackRailId = selectFallbackRail(options, selected.railId);

  return {
    id,
    paymentId,
    decisionTimestamp: new Date(),
    urgencyLevel,
    optionsConsidered: sortedOptions,
    selectedRailId: selected.railId,
    selectionReason: generateSelectionReason(selected, urgencyLevel, effectiveWeights),
    fallbackRailId,
    scoreWeights: effectiveWeights,
  };
}
