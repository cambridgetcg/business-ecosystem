/**
 * Event Correlation Types
 * Types for tracking business processes across services
 */

import type { OperationalDomain } from '../types.js';

/**
 * Status of a business process
 */
export enum ProcessStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * A correlated event within a business process
 */
export interface CorrelatedEvent {
  /** Unique event identifier */
  id: string;
  /** Type of event (e.g., 'payment.initiated', 'contract.signed') */
  type: string;
  /** Correlation ID linking related events */
  correlationId: string;
  /** Causation ID - the event that caused this event */
  causationId?: string;
  /** Entity this event relates to */
  entityId: string;
  /** Domain/service that produced this event */
  source: OperationalDomain | string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** When the event occurred */
  occurredAt: Date;
  /** When the event was received by the correlation service */
  receivedAt: Date;
  /** User who triggered the event */
  userId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * SLA configuration for a process type
 */
export interface SLAConfig {
  /** Maximum duration in milliseconds */
  maxDurationMs: number;
  /** Warning threshold in milliseconds */
  warningThresholdMs: number;
  /** Events that indicate SLA starts */
  startEvents: string[];
  /** Events that indicate SLA ends */
  endEvents: string[];
}

/**
 * SLA status for a process
 */
export interface SLAStatus {
  /** Whether the process is within SLA */
  withinSLA: boolean;
  /** Time elapsed since process start in milliseconds */
  elapsedMs: number;
  /** Maximum allowed duration in milliseconds */
  maxDurationMs: number;
  /** Time remaining before SLA violation */
  remainingMs: number;
  /** Whether the process is in warning state */
  isWarning: boolean;
  /** Warning threshold in milliseconds */
  warningThresholdMs: number;
  /** Whether the SLA has been violated */
  isViolated: boolean;
  /** When the process started */
  startedAt?: Date;
  /** Expected completion time based on SLA */
  expectedCompletionAt?: Date;
}

/**
 * A business process tracking a chain of related events
 */
export interface BusinessProcess {
  /** Correlation ID identifying the process */
  correlationId: string;
  /** Entity the process relates to */
  entityId: string;
  /** Type of business process (e.g., 'payment-approval', 'contract-execution') */
  processType: string;
  /** Current status of the process */
  status: ProcessStatus;
  /** All events in this process chain */
  events: CorrelatedEvent[];
  /** Domains involved in this process */
  domains: Set<OperationalDomain | string>;
  /** When the process started */
  startedAt: Date;
  /** When the process was last updated */
  lastUpdatedAt: Date;
  /** When the process completed (if applicable) */
  completedAt?: Date;
  /** SLA status if configured */
  slaStatus?: SLAStatus;
  /** Current step/stage in the process */
  currentStep?: string;
  /** Error message if process failed */
  errorMessage?: string;
  /** Additional process metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Summary of a business process for listing
 */
export interface ProcessSummary {
  correlationId: string;
  entityId: string;
  processType: string;
  status: ProcessStatus;
  eventCount: number;
  domains: string[];
  startedAt: Date;
  lastUpdatedAt: Date;
  completedAt?: Date;
  slaStatus?: Pick<SLAStatus, 'withinSLA' | 'isWarning' | 'isViolated' | 'remainingMs'>;
  currentStep?: string;
}

/**
 * SLA violation record
 */
export interface SLAViolation {
  correlationId: string;
  entityId: string;
  processType: string;
  violatedAt: Date;
  elapsedMs: number;
  maxDurationMs: number;
  currentStatus: ProcessStatus;
  domains: string[];
}
