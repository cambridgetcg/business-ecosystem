/**
 * Base Domain Event
 *
 * All domain events extend this interface to ensure consistent
 * metadata across the ecosystem.
 */
export interface DomainEvent<T extends string = string, P = unknown> {
  /** Unique event ID */
  readonly eventId: string;

  /** Event type (e.g., 'entity.created', 'payment.completed') */
  readonly eventType: T;

  /** ISO timestamp when event occurred */
  readonly occurredAt: string;

  /** Entity ID that this event relates to (if applicable) */
  readonly entityId?: string;

  /** Aggregate ID that produced this event */
  readonly aggregateId: string;

  /** Aggregate type (e.g., 'LegalEntity', 'BankAccount') */
  readonly aggregateType: string;

  /** Version of the aggregate after this event */
  readonly aggregateVersion: number;

  /** User or system that triggered the event */
  readonly triggeredBy: string;

  /** Correlation ID for tracing related events */
  readonly correlationId?: string;

  /** Causation ID - the event that caused this event */
  readonly causationId?: string;

  /** Event payload */
  readonly payload: P;

  /** Event metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Event envelope for transport
 */
export interface EventEnvelope<E extends DomainEvent = DomainEvent> {
  readonly event: E;
  readonly publishedAt: string;
  readonly source: string; // Service that published the event
  readonly schemaVersion: string;
}

/**
 * Event handler function type
 */
export type EventHandler<E extends DomainEvent> = (event: E) => Promise<void>;

/**
 * Event subscriber interface
 */
export interface EventSubscriber {
  readonly eventTypes: string[];
  handle(event: DomainEvent): Promise<void>;
}

/**
 * Event publisher interface
 */
export interface EventPublisher {
  publish<E extends DomainEvent>(event: E): Promise<void>;
  publishBatch<E extends DomainEvent>(events: E[]): Promise<void>;
}

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return crypto.randomUUID();
}

/**
 * Create a domain event with standard metadata
 */
export function createDomainEvent<T extends string, P>(
  eventType: T,
  aggregateId: string,
  aggregateType: string,
  aggregateVersion: number,
  payload: P,
  options?: {
    entityId?: string;
    triggeredBy?: string;
    correlationId?: string;
    causationId?: string;
    metadata?: Record<string, unknown>;
  }
): DomainEvent<T, P> {
  return {
    eventId: generateEventId(),
    eventType,
    occurredAt: new Date().toISOString(),
    aggregateId,
    aggregateType,
    aggregateVersion,
    payload,
    entityId: options?.entityId,
    triggeredBy: options?.triggeredBy ?? 'system',
    correlationId: options?.correlationId,
    causationId: options?.causationId,
    metadata: options?.metadata,
  };
}
