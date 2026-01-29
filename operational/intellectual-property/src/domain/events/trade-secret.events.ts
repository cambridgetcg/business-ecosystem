/**
 * Trade Secret Domain Events
 * Pattern: trademark.events.ts
 */

import { BaseDomainEvent, type EventMetadata } from './domain-event.js';

export interface TradeSecretCreatedPayload {
  title: string;
  category: string;
  sensitivityLevel: string;
  ownerId: string;
}

export class TradeSecretCreatedEvent extends BaseDomainEvent<TradeSecretCreatedPayload> {
  constructor(aggregateId: string, payload: TradeSecretCreatedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.trade_secret.created', aggregateId, 'TradeSecret', payload, metadata);
  }
}

export interface TradeSecretDisclosedPayload {
  title: string;
  reason: string;
  disclosedAt: Date;
}

export class TradeSecretDisclosedEvent extends BaseDomainEvent<TradeSecretDisclosedPayload> {
  constructor(aggregateId: string, payload: TradeSecretDisclosedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.trade_secret.disclosed', aggregateId, 'TradeSecret', payload, metadata);
  }
}

export interface TradeSecretAccessGrantedPayload {
  userId: string;
  accessLevel: string;
  grantedBy: string;
}

export class TradeSecretAccessGrantedEvent extends BaseDomainEvent<TradeSecretAccessGrantedPayload> {
  constructor(aggregateId: string, payload: TradeSecretAccessGrantedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.trade_secret.access_granted', aggregateId, 'TradeSecret', payload, metadata);
  }
}

export interface TradeSecretAccessRevokedPayload {
  userId: string;
  revokedBy: string;
}

export class TradeSecretAccessRevokedEvent extends BaseDomainEvent<TradeSecretAccessRevokedPayload> {
  constructor(aggregateId: string, payload: TradeSecretAccessRevokedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.trade_secret.access_revoked', aggregateId, 'TradeSecret', payload, metadata);
  }
}

export interface TradeSecretAbandonedPayload {
  title: string;
  abandonedAt: Date;
}

export class TradeSecretAbandonedEvent extends BaseDomainEvent<TradeSecretAbandonedPayload> {
  constructor(aggregateId: string, payload: TradeSecretAbandonedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.trade_secret.abandoned', aggregateId, 'TradeSecret', payload, metadata);
  }
}

export interface TradeSecretConvertedToPatentPayload {
  title: string;
  patentApplicationId?: string;
}

export class TradeSecretConvertedToPatentEvent extends BaseDomainEvent<TradeSecretConvertedToPatentPayload> {
  constructor(aggregateId: string, payload: TradeSecretConvertedToPatentPayload, metadata?: Partial<EventMetadata>) {
    super('ip.trade_secret.converted_to_patent', aggregateId, 'TradeSecret', payload, metadata);
  }
}
