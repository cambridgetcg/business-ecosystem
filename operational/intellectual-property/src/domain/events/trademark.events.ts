/**
 * Trademark Domain Events
 * Pattern: patent.events.ts
 */

import { BaseDomainEvent, type EventMetadata } from './domain-event.js';

export interface TrademarkRegisteredPayload {
  registrationNumber: string;
  mark: string;
  registrationDate: Date;
  expirationDate: Date;
  niceClasses: number[];
}

export class TrademarkRegisteredEvent extends BaseDomainEvent<TrademarkRegisteredPayload> {
  constructor(aggregateId: string, payload: TrademarkRegisteredPayload, metadata?: Partial<EventMetadata>) {
    super('ip.trademark.registered', aggregateId, 'Trademark', payload, metadata);
  }
}

export interface TrademarkRenewedPayload {
  registrationNumber: string;
  previousExpiration: Date;
  newExpiration: Date;
}

export class TrademarkRenewedEvent extends BaseDomainEvent<TrademarkRenewedPayload> {
  constructor(aggregateId: string, payload: TrademarkRenewedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.trademark.renewed', aggregateId, 'Trademark', payload, metadata);
  }
}
