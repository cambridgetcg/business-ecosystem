/**
 * Correlation Store
 * In-memory store for correlating events (can be replaced with Redis later)
 */

import type {
  CorrelatedEvent,
  BusinessProcess,
  ProcessStatus,
  SLAConfig,
  SLAStatus,
  SLAViolation,
  ProcessSummary,
} from './types.js';
import { ProcessStatus as Status } from './types.js';
import type { OperationalDomain } from '../types.js';

/**
 * Default SLA configurations by process type
 */
const DEFAULT_SLA_CONFIGS: Record<string, SLAConfig> = {
  'payment-approval': {
    maxDurationMs: 24 * 60 * 60 * 1000, // 24 hours
    warningThresholdMs: 20 * 60 * 60 * 1000, // 20 hours
    startEvents: ['payment.approval.requested', 'payment.initiated'],
    endEvents: ['payment.approved', 'payment.rejected', 'payment.completed'],
  },
  'contract-execution': {
    maxDurationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    warningThresholdMs: 5 * 24 * 60 * 60 * 1000, // 5 days
    startEvents: ['contract.created', 'contract.draft.finalized'],
    endEvents: ['contract.executed', 'contract.terminated', 'contract.cancelled'],
  },
  'kyc-verification': {
    maxDurationMs: 3 * 24 * 60 * 60 * 1000, // 3 days
    warningThresholdMs: 2 * 24 * 60 * 60 * 1000, // 2 days
    startEvents: ['kyc.verification.started', 'identity.verification.requested'],
    endEvents: ['kyc.verification.completed', 'kyc.verification.failed'],
  },
  'compliance-review': {
    maxDurationMs: 5 * 24 * 60 * 60 * 1000, // 5 days
    warningThresholdMs: 4 * 24 * 60 * 60 * 1000, // 4 days
    startEvents: ['compliance.review.started', 'compliance.check.initiated'],
    endEvents: ['compliance.review.completed', 'compliance.review.approved', 'compliance.review.rejected'],
  },
  default: {
    maxDurationMs: 48 * 60 * 60 * 1000, // 48 hours
    warningThresholdMs: 36 * 60 * 60 * 1000, // 36 hours
    startEvents: [],
    endEvents: [],
  },
};

export interface CorrelationStoreOptions {
  /** Maximum number of processes to keep in memory */
  maxProcesses?: number;
  /** Time-to-live for completed processes in milliseconds */
  completedProcessTTL?: number;
  /** Custom SLA configurations */
  slaConfigs?: Record<string, SLAConfig>;
}

export class CorrelationStore {
  private processes: Map<string, BusinessProcess> = new Map();
  private eventsByCorrelationId: Map<string, CorrelatedEvent[]> = new Map();
  private processesByEntity: Map<string, Set<string>> = new Map();
  private slaConfigs: Record<string, SLAConfig>;
  private maxProcesses: number;
  private completedProcessTTL: number;
  private cleanupIntervalId?: ReturnType<typeof setInterval>;

  constructor(options: CorrelationStoreOptions = {}) {
    this.maxProcesses = options.maxProcesses || 10000;
    this.completedProcessTTL = options.completedProcessTTL || 24 * 60 * 60 * 1000; // 24 hours
    this.slaConfigs = { ...DEFAULT_SLA_CONFIGS, ...options.slaConfigs };

    // Start cleanup interval
    this.cleanupIntervalId = setInterval(() => this.cleanup(), 60 * 1000); // Every minute
  }

  /**
   * Add an event to the correlation store
   */
  addEvent(event: CorrelatedEvent): BusinessProcess {
    const { correlationId, entityId, source, type } = event;

    // Get or create process
    let process = this.processes.get(correlationId);
    const isNewProcess = !process;

    if (!process) {
      process = this.createProcess(correlationId, entityId, type);
    }

    // Add event to process
    process.events.push(event);
    process.domains.add(source);
    process.lastUpdatedAt = event.receivedAt;

    // Update process status based on event type
    this.updateProcessStatus(process, event);

    // Store event by correlation ID
    const events = this.eventsByCorrelationId.get(correlationId) || [];
    events.push(event);
    this.eventsByCorrelationId.set(correlationId, events);

    // Index by entity
    const entityProcesses = this.processesByEntity.get(entityId) || new Set();
    entityProcesses.add(correlationId);
    this.processesByEntity.set(entityId, entityProcesses);

    // Save updated process
    this.processes.set(correlationId, process);

    // Update SLA status
    process.slaStatus = this.calculateSLAStatus(process);

    // Enforce max processes limit
    if (isNewProcess && this.processes.size > this.maxProcesses) {
      this.evictOldestProcess();
    }

    return process;
  }

  /**
   * Get a process by correlation ID
   */
  getProcess(correlationId: string): BusinessProcess | undefined {
    const process = this.processes.get(correlationId);
    if (process) {
      process.slaStatus = this.calculateSLAStatus(process);
    }
    return process;
  }

  /**
   * Get all events for a correlation ID
   */
  getEvents(correlationId: string): CorrelatedEvent[] {
    return this.eventsByCorrelationId.get(correlationId) || [];
  }

  /**
   * Get all processes for an entity
   */
  getProcessesByEntity(entityId: string): BusinessProcess[] {
    const correlationIds = this.processesByEntity.get(entityId);
    if (!correlationIds) return [];

    return Array.from(correlationIds)
      .map(id => this.getProcess(id))
      .filter((p): p is BusinessProcess => p !== undefined);
  }

  /**
   * Get all active processes
   */
  getActiveProcesses(): BusinessProcess[] {
    return Array.from(this.processes.values())
      .filter(p => p.status === Status.Pending || p.status === Status.InProgress)
      .map(p => {
        p.slaStatus = this.calculateSLAStatus(p);
        return p;
      });
  }

  /**
   * Get all processes with pagination
   */
  getAllProcesses(options: {
    status?: ProcessStatus;
    entityId?: string;
    processType?: string;
    limit?: number;
    offset?: number;
  } = {}): { processes: ProcessSummary[]; total: number } {
    const { status, entityId, processType, limit = 50, offset = 0 } = options;

    let processes = Array.from(this.processes.values());

    // Apply filters
    if (status) {
      processes = processes.filter(p => p.status === status);
    }
    if (entityId) {
      processes = processes.filter(p => p.entityId === entityId);
    }
    if (processType) {
      processes = processes.filter(p => p.processType === processType);
    }

    // Sort by last updated descending
    processes.sort((a, b) => b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime());

    const total = processes.length;

    // Apply pagination
    const paginatedProcesses = processes.slice(offset, offset + limit);

    // Convert to summaries
    const summaries: ProcessSummary[] = paginatedProcesses.map(p => {
      const slaStatus = this.calculateSLAStatus(p);
      return {
        correlationId: p.correlationId,
        entityId: p.entityId,
        processType: p.processType,
        status: p.status,
        eventCount: p.events.length,
        domains: Array.from(p.domains),
        startedAt: p.startedAt,
        lastUpdatedAt: p.lastUpdatedAt,
        completedAt: p.completedAt,
        slaStatus: slaStatus ? {
          withinSLA: slaStatus.withinSLA,
          isWarning: slaStatus.isWarning,
          isViolated: slaStatus.isViolated,
          remainingMs: slaStatus.remainingMs,
        } : undefined,
        currentStep: p.currentStep,
      };
    });

    return { processes: summaries, total };
  }

  /**
   * Check SLA status for a process
   */
  checkSLA(correlationId: string): SLAStatus | undefined {
    const process = this.processes.get(correlationId);
    if (!process) return undefined;

    return this.calculateSLAStatus(process);
  }

  /**
   * Get all SLA violations
   */
  getSLAViolations(): SLAViolation[] {
    const violations: SLAViolation[] = [];

    for (const process of this.processes.values()) {
      const slaStatus = this.calculateSLAStatus(process);
      if (slaStatus && slaStatus.isViolated) {
        violations.push({
          correlationId: process.correlationId,
          entityId: process.entityId,
          processType: process.processType,
          violatedAt: new Date(process.startedAt.getTime() + slaStatus.maxDurationMs),
          elapsedMs: slaStatus.elapsedMs,
          maxDurationMs: slaStatus.maxDurationMs,
          currentStatus: process.status,
          domains: Array.from(process.domains),
        });
      }
    }

    // Sort by elapsed time descending (worst violations first)
    violations.sort((a, b) => (b.elapsedMs - b.maxDurationMs) - (a.elapsedMs - a.maxDurationMs));

    return violations;
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalProcesses: number;
    activeProcesses: number;
    completedProcesses: number;
    failedProcesses: number;
    totalEvents: number;
    slaViolations: number;
  } {
    let activeCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    let slaViolationCount = 0;
    let totalEvents = 0;

    for (const process of this.processes.values()) {
      totalEvents += process.events.length;

      switch (process.status) {
        case Status.Pending:
        case Status.InProgress:
          activeCount++;
          break;
        case Status.Completed:
          completedCount++;
          break;
        case Status.Failed:
          failedCount++;
          break;
      }

      const slaStatus = this.calculateSLAStatus(process);
      if (slaStatus?.isViolated) {
        slaViolationCount++;
      }
    }

    return {
      totalProcesses: this.processes.size,
      activeProcesses: activeCount,
      completedProcesses: completedCount,
      failedProcesses: failedCount,
      totalEvents,
      slaViolations: slaViolationCount,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.processes.clear();
    this.eventsByCorrelationId.clear();
    this.processesByEntity.clear();
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
  }

  // Private methods

  private createProcess(correlationId: string, entityId: string, eventType: string): BusinessProcess {
    const processType = this.inferProcessType(eventType);
    const now = new Date();

    return {
      correlationId,
      entityId,
      processType,
      status: Status.Pending,
      events: [],
      domains: new Set(),
      startedAt: now,
      lastUpdatedAt: now,
    };
  }

  private inferProcessType(eventType: string): string {
    // Infer process type from event type
    const parts = eventType.split('.');
    if (parts.length >= 2) {
      return parts.slice(0, 2).join('-');
    }
    return 'unknown';
  }

  private updateProcessStatus(process: BusinessProcess, event: CorrelatedEvent): void {
    const eventType = event.type.toLowerCase();
    const slaConfig = this.slaConfigs[process.processType] || this.slaConfigs.default;

    // Check if this is a start event
    if (slaConfig.startEvents.some(e => eventType.includes(e.toLowerCase()))) {
      if (process.status === Status.Pending) {
        process.status = Status.InProgress;
      }
    }

    // Check if this is an end event
    if (slaConfig.endEvents.some(e => eventType.includes(e.toLowerCase()))) {
      if (eventType.includes('fail') || eventType.includes('reject') || eventType.includes('error')) {
        process.status = Status.Failed;
        process.errorMessage = (event.payload.error as string) || (event.payload.reason as string) || 'Process failed';
      } else {
        process.status = Status.Completed;
      }
      process.completedAt = event.receivedAt;
    }

    // Also check for explicit status changes
    if (eventType.includes('started') || eventType.includes('initiated')) {
      process.status = Status.InProgress;
    } else if (eventType.includes('completed') || eventType.includes('finished') || eventType.includes('approved')) {
      process.status = Status.Completed;
      process.completedAt = event.receivedAt;
    } else if (eventType.includes('failed') || eventType.includes('error') || eventType.includes('rejected')) {
      process.status = Status.Failed;
      process.completedAt = event.receivedAt;
    }

    // Update current step
    process.currentStep = event.type;
  }

  private calculateSLAStatus(process: BusinessProcess): SLAStatus | undefined {
    const slaConfig = this.slaConfigs[process.processType] || this.slaConfigs.default;

    const now = new Date();
    const elapsedMs = process.completedAt
      ? process.completedAt.getTime() - process.startedAt.getTime()
      : now.getTime() - process.startedAt.getTime();

    const remainingMs = slaConfig.maxDurationMs - elapsedMs;
    const isViolated = elapsedMs > slaConfig.maxDurationMs;
    const isWarning = !isViolated && elapsedMs > slaConfig.warningThresholdMs;

    return {
      withinSLA: !isViolated,
      elapsedMs,
      maxDurationMs: slaConfig.maxDurationMs,
      remainingMs: Math.max(0, remainingMs),
      isWarning,
      warningThresholdMs: slaConfig.warningThresholdMs,
      isViolated,
      startedAt: process.startedAt,
      expectedCompletionAt: new Date(process.startedAt.getTime() + slaConfig.maxDurationMs),
    };
  }

  private evictOldestProcess(): void {
    // Find the oldest completed process
    let oldestProcess: BusinessProcess | undefined;
    let oldestTime = Date.now();

    for (const process of this.processes.values()) {
      if (
        (process.status === Status.Completed || process.status === Status.Failed) &&
        process.lastUpdatedAt.getTime() < oldestTime
      ) {
        oldestProcess = process;
        oldestTime = process.lastUpdatedAt.getTime();
      }
    }

    if (oldestProcess) {
      this.removeProcess(oldestProcess.correlationId);
    }
  }

  private removeProcess(correlationId: string): void {
    const process = this.processes.get(correlationId);
    if (!process) return;

    // Remove from entity index
    const entityProcesses = this.processesByEntity.get(process.entityId);
    if (entityProcesses) {
      entityProcesses.delete(correlationId);
      if (entityProcesses.size === 0) {
        this.processesByEntity.delete(process.entityId);
      }
    }

    // Remove events
    this.eventsByCorrelationId.delete(correlationId);

    // Remove process
    this.processes.delete(correlationId);
  }

  private cleanup(): void {
    const now = Date.now();

    for (const process of this.processes.values()) {
      // Remove completed/failed processes that have exceeded TTL
      if (
        (process.status === Status.Completed || process.status === Status.Failed) &&
        process.completedAt &&
        now - process.completedAt.getTime() > this.completedProcessTTL
      ) {
        this.removeProcess(process.correlationId);
      }
    }
  }
}

// Export a singleton instance
export const correlationStore = new CorrelationStore();
