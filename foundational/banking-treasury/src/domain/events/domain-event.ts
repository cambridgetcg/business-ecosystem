/**
 * Domain Event Base Interface
 * 
 * Domain events represent something that happened in the domain.
 * They are collected by aggregates and dispatched after persistence.
 */
export interface DomainEvent {
  type: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

/**
 * Aggregate root interface - entities that emit domain events
 */
export interface AggregateRoot {
  pullDomainEvents(): DomainEvent[];
}
