/**
 * Patent Family Domain Events
 * Pattern: trademark.events.ts
 */

import { BaseDomainEvent, type EventMetadata } from './domain-event.js';

export interface PatentFamilyCreatedPayload {
  familyName: string;
  priorityPatentId: string;
  priorityDate: Date;
}

export class PatentFamilyCreatedEvent extends BaseDomainEvent<PatentFamilyCreatedPayload> {
  constructor(aggregateId: string, payload: PatentFamilyCreatedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.patent_family.created', aggregateId, 'PatentFamily', payload, metadata);
  }
}

export interface PatentFamilyMemberAddedPayload {
  memberId: string;
  patentId: string;
  parentPatentId?: string | undefined;
  continuationType: string;
}

export class PatentFamilyMemberAddedEvent extends BaseDomainEvent<PatentFamilyMemberAddedPayload> {
  constructor(aggregateId: string, payload: PatentFamilyMemberAddedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.patent_family.member_added', aggregateId, 'PatentFamily', payload, metadata);
  }
}

export interface PatentFamilyMemberRemovedPayload {
  patentId: string;
}

export class PatentFamilyMemberRemovedEvent extends BaseDomainEvent<PatentFamilyMemberRemovedPayload> {
  constructor(aggregateId: string, payload: PatentFamilyMemberRemovedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.patent_family.member_removed', aggregateId, 'PatentFamily', payload, metadata);
  }
}
