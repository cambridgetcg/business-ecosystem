/**
 * Core messaging types
 */

export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  payload: T;
  metadata: EventMetadata;
  occurredAt: Date;
  version: number;
}

export interface EventMetadata {
  correlationId: string;
  causationId?: string;
  userId?: string;
  tenantId?: string;
  source: string;
  timestamp: Date;
}

export interface EventHandler<T = unknown> {
  handle(event: DomainEvent<T>): Promise<void>;
}

export interface MessageBrokerConfig {
  url: string;
  exchange?: string;
  queue?: string;
  prefetch?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export type EventSubscription = {
  eventType: string;
  handler: EventHandler;
  queue?: string;
};
