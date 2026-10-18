/**
 * Correlation Service
 * Service for correlating events and tracking business processes
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import type {
  CorrelatedEvent,
  BusinessProcess,
  ProcessStatus,
  SLAStatus,
  SLAViolation,
  ProcessSummary,
  SLAConfig,
} from './types.js';
import { ProcessStatus as Status } from './types.js';
import { CorrelationStore, type CorrelationStoreOptions } from './correlation-store.js';
import type { OperationalDomain } from '../types.js';

const logger = pino({ name: 'correlation-service' });

export interface CorrelationServiceOptions extends CorrelationStoreOptions {
  /** Service name for logging */
  serviceName?: string;
}

export interface IncomingEvent {
  /** Event ID (generated if not provided) */
  id?: string;
  /** Event type */
  type: string;
  /** Correlation ID (generated if not provided) */
  correlationId?: string;
  /** Causation ID */
  causationId?: string;
  /** Entity ID */
  entityId: string;
  /** Source domain/service */
  source: OperationalDomain | string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** When the event occurred (defaults to now) */
  occurredAt?: Date;
  /** User who triggered the event */
  userId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export class CorrelationService {
  private store: CorrelationStore;
  private serviceName: string;

  constructor(options: CorrelationServiceOptions = {}) {
    this.store = new CorrelationStore(options);
    this.serviceName = options.serviceName || 'correlation-service';
  }

  /**
   * Correlate an incoming event
   * Returns the business process the event belongs to
   */
  correlateEvent(event: IncomingEvent): BusinessProcess {
    const correlatedEvent = this.toCorrelatedEvent(event);

    logger.info({
      eventId: correlatedEvent.id,
      eventType: correlatedEvent.type,
      correlationId: correlatedEvent.correlationId,
      entityId: correlatedEvent.entityId,
      source: correlatedEvent.source,
    }, 'Correlating event');

    const process = this.store.addEvent(correlatedEvent);

    logger.debug({
      correlationId: process.correlationId,
      status: process.status,
      eventCount: process.events.length,
      domains: Array.from(process.domains),
    }, 'Event correlated to process');

    return process;
  }

  /**
   * Correlate multiple events
   */
  correlateEvents(events: IncomingEvent[]): BusinessProcess[] {
    return events.map(event => this.correlateEvent(event));
  }

  /**
   * Get a process by correlation ID
   */
  getProcess(correlationId: string): BusinessProcess | undefined {
    return this.store.getProcess(correlationId);
  }

  /**
   * Get the full event timeline for a process
   */
  getProcessTimeline(correlationId: string): CorrelatedEvent[] {
    return this.store.getEvents(correlationId);
  }

  /**
   * Check if a process is within SLA
   */
  checkSLA(correlationId: string): SLAStatus | undefined {
    const slaStatus = this.store.checkSLA(correlationId);

    if (slaStatus) {
      logger.debug({
        correlationId,
        withinSLA: slaStatus.withinSLA,
        isWarning: slaStatus.isWarning,
        isViolated: slaStatus.isViolated,
        remainingMs: slaStatus.remainingMs,
      }, 'SLA check');
    }

    return slaStatus;
  }

  /**
   * Get all active processes
   */
  getActiveProcesses(): BusinessProcess[] {
    return this.store.getActiveProcesses();
  }

  /**
   * Get all processes with optional filtering and pagination
   */
  getProcesses(options: {
    status?: ProcessStatus;
    entityId?: string;
    processType?: string;
    limit?: number;
    offset?: number;
  } = {}): { processes: ProcessSummary[]; total: number } {
    return this.store.getAllProcesses(options);
  }

  /**
   * Get all processes for an entity
   */
  getProcessesByEntity(entityId: string): BusinessProcess[] {
    return this.store.getProcessesByEntity(entityId);
  }

  /**
   * Get process summaries for an entity
   */
  getProcessSummariesByEntity(entityId: string, options: {
    status?: ProcessStatus;
    limit?: number;
    offset?: number;
  } = {}): { processes: ProcessSummary[]; total: number } {
    return this.store.getAllProcesses({ ...options, entityId });
  }

  /**
   * Get all SLA violations
   */
  getSLAViolations(): SLAViolation[] {
    return this.store.getSLAViolations();
  }

  /**
   * Get processes that are close to SLA violation (in warning state)
   */
  getProcessesAtRisk(): BusinessProcess[] {
    return this.getActiveProcesses().filter(p => p.slaStatus?.isWarning);
  }

  /**
   * Get statistics about the correlation store
   */
  getStats(): {
    totalProcesses: number;
    activeProcesses: number;
    completedProcesses: number;
    failedProcesses: number;
    totalEvents: number;
    slaViolations: number;
  } {
    return this.store.getStats();
  }

  /**
   * Get a dashboard summary
   */
  getDashboard(): {
    stats: ReturnType<typeof this.getStats>;
    recentProcesses: ProcessSummary[];
    slaViolations: SLAViolation[];
    atRiskProcesses: ProcessSummary[];
  } {
    const stats = this.getStats();
    const { processes: recentProcesses } = this.getProcesses({ limit: 10 });
    const slaViolations = this.getSLAViolations().slice(0, 10);
    const atRiskProcesses: ProcessSummary[] = this.getProcessesAtRisk()
      .slice(0, 10)
      .map(p => ({
        correlationId: p.correlationId,
        entityId: p.entityId,
        processType: p.processType,
        status: p.status,
        eventCount: p.events.length,
        domains: Array.from(p.domains),
        startedAt: p.startedAt,
        lastUpdatedAt: p.lastUpdatedAt,
        completedAt: p.completedAt,
        slaStatus: p.slaStatus ? {
          withinSLA: p.slaStatus.withinSLA,
          isWarning: p.slaStatus.isWarning,
          isViolated: p.slaStatus.isViolated,
          remainingMs: p.slaStatus.remainingMs,
        } : undefined,
        currentStep: p.currentStep,
      }));

    return {
      stats,
      recentProcesses,
      slaViolations,
      atRiskProcesses,
    };
  }

  /**
   * Create a new correlation context
   * Returns a correlation ID that can be used to link related events
   */
  createCorrelationContext(entityId: string, processType?: string): string {
    const correlationId = uuidv4();

    logger.info({
      correlationId,
      entityId,
      processType,
    }, 'Created correlation context');

    return correlationId;
  }

  /**
   * Clear all correlation data
   */
  clear(): void {
    this.store.clear();
    logger.info('Correlation store cleared');
  }

  /**
   * Destroy the service and cleanup resources
   */
  destroy(): void {
    this.store.destroy();
    logger.info('Correlation service destroyed');
  }

  // Private methods

  private toCorrelatedEvent(event: IncomingEvent): CorrelatedEvent {
    const now = new Date();

    return {
      id: event.id || uuidv4(),
      type: event.type,
      correlationId: event.correlationId || uuidv4(),
      causationId: event.causationId,
      entityId: event.entityId,
      source: event.source,
      payload: event.payload,
      occurredAt: event.occurredAt || now,
      receivedAt: now,
      userId: event.userId,
      metadata: event.metadata,
    };
  }
}

// Export a singleton instance
export const correlationService = new CorrelationService();
