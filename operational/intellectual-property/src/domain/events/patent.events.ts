/**
 * Patent Domain Events
 */

import { BaseDomainEvent, type EventMetadata } from './domain-event.js';

export interface PatentFiledPayload {
  applicationNumber: string;
  title: string;
  filingDate: Date;
  type: string;
  inventors: string[];
}

export class PatentFiledEvent extends BaseDomainEvent<PatentFiledPayload> {
  constructor(aggregateId: string, payload: PatentFiledPayload, metadata?: Partial<EventMetadata>) {
    super('ip.patent.filed', aggregateId, 'Patent', payload, metadata);
  }
}

export interface PatentGrantedPayload {
  patentNumber: string;
  applicationNumber: string;
  title: string;
  grantDate: Date;
  expirationDate: Date;
}

export class PatentGrantedEvent extends BaseDomainEvent<PatentGrantedPayload> {
  constructor(aggregateId: string, payload: PatentGrantedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.patent.granted', aggregateId, 'Patent', payload, metadata);
  }
}

export interface PatentAbandonedPayload {
  applicationNumber: string | undefined;
  patentNumber: string | undefined;
  previousStatus: string;
  reason: string;
}

export class PatentAbandonedEvent extends BaseDomainEvent<PatentAbandonedPayload> {
  constructor(aggregateId: string, payload: PatentAbandonedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.patent.abandoned', aggregateId, 'Patent', payload, metadata);
  }
}
