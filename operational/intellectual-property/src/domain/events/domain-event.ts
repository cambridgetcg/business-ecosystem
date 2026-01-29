/**
 * Domain Event base types for IP domain
 * Aligned with: shared/libs/messaging/src/types.ts
 */

import { randomUUID } from 'crypto';

export interface EventMetadata {
  correlationId: string;
  causationId: string | undefined;
  userId: string | undefined;
  tenantId: string | undefined;
  source: string;
  timestamp: Date;
}

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

export abstract class BaseDomainEvent<T = unknown> implements DomainEvent<T> {
  public readonly id: string;
  public readonly occurredAt: Date;
  public readonly metadata: EventMetadata;
  public readonly version: number;

  constructor(
    public readonly type: string,
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly payload: T,
    metadata?: Partial<EventMetadata>,
    version = 1
  ) {
    this.id = randomUUID();
    this.occurredAt = new Date();
    this.version = version;
    this.metadata = {
      correlationId: metadata?.correlationId ?? randomUUID(),
      causationId: metadata?.causationId,
      userId: metadata?.userId,
      tenantId: metadata?.tenantId,
      source: metadata?.source ?? 'intellectual-property',
      timestamp: metadata?.timestamp ?? new Date(),
    };
  }
}
