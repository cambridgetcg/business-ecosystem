/**
 * Event Handler
 * Subscribes to ecosystem events and automatically correlates them
 */

import pino from 'pino';
import { correlationService, type CorrelationService } from './correlation-service.js';
import type { OperationalDomain } from '../types.js';

const logger = pino({ name: 'correlation-event-handler' });

/**
 * Event shape from the ecosystem messaging system
 * Compatible with @ecosystem/messaging DomainEvent
 */
export interface EcosystemEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  metadata: {
    correlationId: string;
    causationId?: string;
    userId?: string;
    tenantId?: string;
    source: string;
    timestamp: Date;
  };
  occurredAt: Date;
  version: number;
}

/**
 * Event bus interface for subscribing to events
 */
export interface EventBus {
  subscribe<T>(eventType: string, handler: { handle(event: T): Promise<void> }): Promise<void>;
  unsubscribe(eventType: string): Promise<void>;
}

/**
 * Configuration for the event handler
 */
export interface EventHandlerConfig {
  /** Event types to subscribe to (supports wildcards like 'payment.*') */
  eventPatterns?: string[];
  /** Domains to correlate events from */
  domains?: (OperationalDomain | string)[];
  /** Whether to auto-subscribe on initialization */
  autoSubscribe?: boolean;
}

const DEFAULT_EVENT_PATTERNS = [
  // Contracts & Legal
  'contract.*',
  'agreement.*',
  'legal.*',

  // Insurance
  'policy.*',
  'claim.*',
  'coverage.*',

  // Intellectual Property
  'patent.*',
  'trademark.*',
  'copyright.*',
  'ip.*',

  // Data Privacy
  'privacy.*',
  'consent.*',
  'data-subject.*',
  'dpia.*',

  // Banking & Treasury
  'payment.*',
  'transfer.*',
  'account.*',
  'cash.*',

  // Compliance
  'compliance.*',
  'obligation.*',
  'audit.*',

  // KYC/Identity
  'kyc.*',
  'identity.*',
  'verification.*',

  // Tax
  'tax.*',
  'filing.*',

  // Entity Governance
  'entity.*',
  'governance.*',
  'director.*',
  'shareholder.*',
];

export class CorrelationEventHandler {
  private service: CorrelationService;
  private eventBus?: EventBus;
  private config: EventHandlerConfig;
  private subscribedPatterns: Set<string> = new Set();

  constructor(
    service: CorrelationService = correlationService,
    config: EventHandlerConfig = {}
  ) {
    this.service = service;
    this.config = {
      eventPatterns: config.eventPatterns || DEFAULT_EVENT_PATTERNS,
      domains: config.domains,
      autoSubscribe: config.autoSubscribe ?? true,
    };
  }

  /**
   * Initialize the event handler with an event bus
   */
  async initialize(eventBus: EventBus): Promise<void> {
    this.eventBus = eventBus;

    logger.info({
      eventPatterns: this.config.eventPatterns,
      autoSubscribe: this.config.autoSubscribe,
    }, 'Initializing correlation event handler');

    if (this.config.autoSubscribe && this.config.eventPatterns) {
      await this.subscribeToPatterns(this.config.eventPatterns);
    }
  }

  /**
   * Subscribe to specific event patterns
   */
  async subscribeToPatterns(patterns: string[]): Promise<void> {
    if (!this.eventBus) {
      throw new Error('Event bus not initialized. Call initialize() first.');
    }

    for (const pattern of patterns) {
      if (this.subscribedPatterns.has(pattern)) {
        continue;
      }

      try {
        await this.eventBus.subscribe(pattern, {
          handle: async (event: EcosystemEvent) => this.handleEvent(event),
        });
        this.subscribedPatterns.add(pattern);
        logger.debug({ pattern }, 'Subscribed to event pattern');
      } catch (error) {
        logger.error({ pattern, error }, 'Failed to subscribe to event pattern');
      }
    }
  }

  /**
   * Unsubscribe from specific event patterns
   */
  async unsubscribeFromPatterns(patterns: string[]): Promise<void> {
    if (!this.eventBus) {
      return;
    }

    for (const pattern of patterns) {
      if (!this.subscribedPatterns.has(pattern)) {
        continue;
      }

      try {
        await this.eventBus.unsubscribe(pattern);
        this.subscribedPatterns.delete(pattern);
        logger.debug({ pattern }, 'Unsubscribed from event pattern');
      } catch (error) {
        logger.error({ pattern, error }, 'Failed to unsubscribe from event pattern');
      }
    }
  }

  /**
   * Handle an incoming ecosystem event
   */
  async handleEvent(event: EcosystemEvent): Promise<void> {
    try {
      // Filter by domain if configured
      if (this.config.domains && this.config.domains.length > 0) {
        const eventSource = this.extractSource(event);
        if (!this.config.domains.includes(eventSource)) {
          logger.debug({
            eventType: event.type,
            source: eventSource,
            allowedDomains: this.config.domains,
          }, 'Skipping event from unconfigured domain');
          return;
        }
      }

      // Extract entity ID from event
      const entityId = this.extractEntityId(event);
      if (!entityId) {
        logger.warn({
          eventType: event.type,
          aggregateId: event.aggregateId,
        }, 'Could not extract entity ID from event');
        return;
      }

      // Correlate the event
      const process = this.service.correlateEvent({
        id: event.id,
        type: event.type,
        correlationId: event.metadata.correlationId,
        causationId: event.metadata.causationId,
        entityId,
        source: this.extractSource(event),
        payload: event.payload,
        occurredAt: event.occurredAt,
        userId: event.metadata.userId,
        metadata: {
          aggregateType: event.aggregateType,
          version: event.version,
          tenantId: event.metadata.tenantId,
        },
      });

      logger.debug({
        eventId: event.id,
        eventType: event.type,
        correlationId: process.correlationId,
        processStatus: process.status,
      }, 'Event correlated');

      // Log SLA warnings
      if (process.slaStatus?.isWarning && !process.slaStatus.isViolated) {
        logger.warn({
          correlationId: process.correlationId,
          processType: process.processType,
          remainingMs: process.slaStatus.remainingMs,
        }, 'Process approaching SLA violation');
      }

      // Log SLA violations
      if (process.slaStatus?.isViolated) {
        logger.error({
          correlationId: process.correlationId,
          processType: process.processType,
          elapsedMs: process.slaStatus.elapsedMs,
          maxDurationMs: process.slaStatus.maxDurationMs,
        }, 'SLA VIOLATION: Process exceeded maximum duration');
      }
    } catch (error) {
      logger.error({
        eventId: event.id,
        eventType: event.type,
        error,
      }, 'Error handling event for correlation');
    }
  }

  /**
   * Process an event directly without going through the event bus
   * Useful for testing or manual correlation
   */
  processEvent(event: EcosystemEvent): void {
    this.handleEvent(event).catch(error => {
      logger.error({ event, error }, 'Error processing event');
    });
  }

  /**
   * Get the list of subscribed patterns
   */
  getSubscribedPatterns(): string[] {
    return Array.from(this.subscribedPatterns);
  }

  /**
   * Shutdown the event handler
   */
  async shutdown(): Promise<void> {
    if (this.eventBus) {
      await this.unsubscribeFromPatterns(Array.from(this.subscribedPatterns));
    }
    logger.info('Correlation event handler shut down');
  }

  // Private methods

  private extractEntityId(event: EcosystemEvent): string | undefined {
    // Try to extract entity ID from various locations

    // 1. Check payload for explicit entityId
    if (event.payload.entityId && typeof event.payload.entityId === 'string') {
      return event.payload.entityId;
    }

    // 2. Check payload for common ID field names
    const idFields = ['entity_id', 'companyId', 'company_id', 'organizationId', 'organization_id', 'tenantId'];
    for (const field of idFields) {
      const value = event.payload[field];
      if (value && typeof value === 'string') {
        return value;
      }
    }

    // 3. Use aggregate ID if it looks like an entity reference
    if (event.aggregateType.toLowerCase().includes('entity') ||
        event.aggregateType.toLowerCase().includes('company') ||
        event.aggregateType.toLowerCase().includes('organization')) {
      return event.aggregateId;
    }

    // 4. Check metadata for tenantId as fallback
    if (event.metadata.tenantId) {
      return event.metadata.tenantId;
    }

    // 5. Use aggregate ID as last resort
    return event.aggregateId;
  }

  private extractSource(event: EcosystemEvent): OperationalDomain | string {
    // Use the source from metadata
    const source = event.metadata.source;

    // Map common source names to operational domains
    const domainMap: Record<string, OperationalDomain> = {
      'contracts': 'contracts-legal',
      'contracts-legal': 'contracts-legal',
      'legal': 'contracts-legal',
      'insurance': 'insurance',
      'ip': 'intellectual-property',
      'intellectual-property': 'intellectual-property',
      'privacy': 'data-privacy',
      'data-privacy': 'data-privacy',
    };

    return domainMap[source.toLowerCase()] || source;
  }
}

// Export a singleton instance
export const correlationEventHandler = new CorrelationEventHandler();
